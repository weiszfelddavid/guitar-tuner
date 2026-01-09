import './style.css';
import { getAudioContext, getMicrophoneStream } from './audio/setup';
import { createTunerWorklet } from './audio/worklet';
import { TunerCanvas } from './ui/canvas';
import { KalmanFilter, TunerState, TunerMode, getDefaultConfig } from './ui/tuner';
import { initDebugConsole } from './ui/debug-console';
import { StringSelector } from './ui/string-selector';
import pkg from '../package.json';

// Enable on-screen debugging for mobile
initDebugConsole();

// Mode management with local storage
const STORAGE_KEY = 'tuner-mode';
let currentMode: TunerMode = (localStorage.getItem(STORAGE_KEY) as TunerMode) || 'strict';

function setMode(mode: TunerMode, tunerNode?: AudioWorkletNode) {
    currentMode = mode;
    localStorage.setItem(STORAGE_KEY, mode);

    // Update Kalman filter smoothing based on mode
    const config = getDefaultConfig(mode);
    kalman.setProcessNoise(config.smoothingFactor);

    // Send mode update to worklet
    if (tunerNode) {
        tunerNode.port.postMessage({ type: 'set-mode', mode });
    }

    // Update UI toggle
    updateModeToggle();
}

function updateModeToggle() {
    const modeLabel = document.getElementById('mode-label');
    if (modeLabel) {
        modeLabel.textContent = currentMode === 'strict' ? 'Pro' : 'Easy';
    }
}

// State management - only visual state on main thread now
let currentState: TunerState = { noteName: '--', cents: 0, clarity: 0, volume: 0, isLocked: false, frequency: 0 };
const kalman = new KalmanFilter(getDefaultConfig(currentMode).smoothingFactor, 0.1);
let stringSelector: StringSelector | null = null;
let smoothedCents = 0;

// Expose state for testing
// @ts-ignore
window.getTunerState = () => currentState;

async function startTuner() {
  try {
    console.log("Starting Tuner...");

    // 1. Setup Audio
    const context = await getAudioContext();
    console.log("AudioContext created. State:", context.state);

    // FIX: Force resume AudioContext if it's suspended (Common on Android/iOS)
    if (context.state === 'suspended') {
      console.log("AudioContext suspended, resuming...");
      await context.resume();
    }

    let micStream = await getMicrophoneStream(context);

    // Log active settings to debug "Silence" issue
    let track = micStream.getAudioTracks()[0];
    if (track) {
        console.log("Mic Label:", track.label);
        console.log("Mic Settings:", JSON.stringify(track.getSettings(), null, 2));
        console.log("Mic Constraints:", JSON.stringify(track.getConstraints(), null, 2));
    } else {
        console.error("No audio track found in stream!");
    }

    // FIX 2: Check resume AGAIN after permission prompt (which might have broken the user gesture chain)
    if (context.state === 'suspended') {
      console.log("AudioContext suspended after permission, resuming...");
      await context.resume();
    }

    let source = context.createMediaStreamSource(micStream);
    const tunerNode = await createTunerWorklet(context);

    // Load WASM from main thread and pass to worklet
    try {
        console.log("Loading WASM from main thread...");
        const wasmRes = await fetch('/pure_tone_bg.wasm');
        if (!wasmRes.ok) throw new Error(`Failed to fetch WASM: ${wasmRes.status} ${wasmRes.statusText}`);

        const contentType = wasmRes.headers.get('Content-Type');
        if (contentType && !contentType.includes('wasm')) {
            throw new Error(`Invalid Content-Type for WASM: ${contentType} (Expected application/wasm)`);
        }

        const wasmBuffer = await wasmRes.arrayBuffer();
        tunerNode.port.postMessage({ type: 'load-wasm', wasmBytes: wasmBuffer }, [wasmBuffer]);
        console.log("WASM sent to worklet");
    } catch (e) {
        console.error("Main Thread WASM Load Error:", e);
    }

    // Send initial mode to worklet
    tunerNode.port.postMessage({ type: 'set-mode', mode: currentMode });

    // 2. Setup UI
    // Remove start container instead of wiping body
    document.querySelector('.start-container')?.remove();

    // Create canvas if it doesn't exist (it shouldn't)
    let canvasEl = document.getElementById('tuner-canvas');
    if (!canvasEl) {
        canvasEl = document.createElement('canvas');
        canvasEl.id = 'tuner-canvas';
        document.body.appendChild(canvasEl);
    }
    const canvas = new TunerCanvas('tuner-canvas');

    // Re-append debug console if it was wiped (just in case)
    const debugConsole = document.getElementById('debug-console');
    if (debugConsole) {
        document.body.appendChild(debugConsole); // Move to end to ensure z-index
    }

    // Add version overlay if not present
    let versionEl = document.getElementById('app-version');
    if (!versionEl) {
        versionEl = document.createElement('div');
        versionEl.id = 'app-version';
        versionEl.style.cssText = 'position:fixed;bottom:10px;right:10px;color:rgba(255,255,255,0.5);font-family:sans-serif;font-size:12px;z-index:100;';
        versionEl.innerText = `v${pkg.version}`;
        document.body.appendChild(versionEl);
    }

    // Add mode toggle if not present
    let modeToggle = document.getElementById('mode-toggle');
    if (!modeToggle) {
        modeToggle = document.createElement('div');
        modeToggle.id = 'mode-toggle';
        modeToggle.innerHTML = `
            <span class="mode-prefix">Mode:</span>
            <span id="mode-label">${currentMode === 'strict' ? 'Pro' : 'Easy'}</span>
        `;
        document.body.appendChild(modeToggle);

        // Toggle between modes on click
        modeToggle.addEventListener('click', () => {
            setMode(currentMode === 'strict' ? 'forgiving' : 'strict', tunerNode);
        });
    }

    // Add debug console toggle button next to mode toggle
    let debugToggle = document.getElementById('debug-toggle');
    if (!debugToggle) {
        debugToggle = document.createElement('div');
        debugToggle.id = 'debug-toggle';
        debugToggle.innerHTML = `
            <span class="mode-prefix">Logs:</span>
            <span id="debug-label">Hidden</span>
        `;
        document.body.appendChild(debugToggle);

        // Toggle debug console on click
        debugToggle.addEventListener('click', () => {
            const isVisible = (window as any).toggleDebugConsole();
            const label = document.getElementById('debug-label');
            if (label) {
                label.textContent = isVisible ? 'Visible' : 'Hidden';
            }
        });

        // Set initial label state
        const isDebugVisible = localStorage.getItem('debug-console-visible') === 'true';
        const label = document.getElementById('debug-label');
        if (label) {
            label.textContent = isDebugVisible ? 'Visible' : 'Hidden';
        }
    }

    // Add string selector component
    if (!stringSelector) {
        stringSelector = new StringSelector();

        // Handle manual string selection
        stringSelector.onSelect((stringId) => {
            if (stringId) {
                const selectedString = stringSelector!.getSelectedString();
                if (selectedString) {
                    console.log(`Manual string lock: ${selectedString.label} (${selectedString.note})`);
                    // Send string lock to worklet
                    tunerNode.port.postMessage({
                        type: 'set-string-lock',
                        stringLock: {
                            note: selectedString.note,
                            frequency: selectedString.frequency
                        }
                    });
                }
            } else {
                console.log('Manual string lock released');
                // Clear string lock in worklet
                tunerNode.port.postMessage({
                    type: 'set-string-lock',
                    stringLock: null
                });
            }
        });
    }

    // FIX 3: Global "Wake Up" listener & UI Overlay
    const checkState = () => {
        if (context.state === 'suspended') {
            // Show a visible overlay if we are suspended
            let overlay = document.getElementById('resume-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'resume-overlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);color:white;display:flex;justify-content:center;align-items:center;z-index:9999;font-size:24px;cursor:pointer;';
                overlay.innerText = 'Tap to Activate Tuner';
                document.body.appendChild(overlay);

                overlay.addEventListener('click', async () => {
                    await context.resume();
                    console.log("Overlay resume triggered");
                    if (context.state === 'running') {
                        overlay?.remove();
                    }
                });
            }
        } else {
             const overlay = document.getElementById('resume-overlay');
             if (overlay) overlay.remove();
        }
    };

    // Check periodically
    setInterval(checkState, 1000);

    // Also check on touch
    document.addEventListener('touchstart', async () => {
        if (context.state === 'suspended') await context.resume();
        checkState();
    }, { passive: true });

    // 3. Audio Loop - Now just receives final state from worklet
    tunerNode.port.onmessage = (event) => {
      const data = event.data;

      // Handle log messages
      if (data.type === 'log') {
          console.log(data.message);
          return;
      }

      // Handle state messages from worklet
      if (data.type === 'state') {
          // Receive final processed state from worklet
          currentState = data.state;

          // Update string selector with current detected string
          if (stringSelector) {
              stringSelector.setAutoDetectedString(currentState.noteName);
          }

          // Apply Kalman filter for visual needle smoothing
          if (currentState.noteName !== '--') {
              smoothedCents = kalman.filter(currentState.cents);
          } else {
              smoothedCents = kalman.filter(0);
          }
      }
    };

    source.connect(tunerNode);
    tunerNode.connect(context.destination);

    // 4. Render Loop
    const render = () => {
      canvas.render(currentState, smoothedCents);
      requestAnimationFrame(render);
    };
    render();

    // 5. Handle Page Visibility (fully release mic when tab is hidden)
    let isConnected = true;

    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        // Tab went to background - FULLY RELEASE microphone
        console.log('Tab hidden - releasing microphone');
        if (isConnected) {
          // Disconnect from audio processing
          source.disconnect();
          isConnected = false;

          // CRITICAL: Stop all tracks to fully release microphone back to OS
          // This allows other apps (dictation, calls, etc.) to use the mic
          micStream.getTracks().forEach(track => {
            console.log('Stopping mic track:', track.label);
            track.stop();
          });

          // Reset state to show no note
          currentState = { noteName: '--', cents: 0, clarity: 0, volume: 0, isLocked: false, frequency: 0 };
          smoothedCents = 0;
        }

        // Suspend audio context to save resources
        if (context.state === 'running') {
          context.suspend();
        }
      } else {
        // Tab came to foreground - request fresh microphone access
        console.log('Tab visible - requesting fresh microphone access');
        if (!isConnected) {
          try {
            // Resume audio context first
            await context.resume();

            // Request fresh microphone stream
            micStream = await getMicrophoneStream(context);
            console.log('Fresh microphone stream acquired');

            // Create new source node with fresh stream
            source = context.createMediaStreamSource(micStream);

            // Connect to tuner
            source.connect(tunerNode);
            isConnected = true;
            console.log('Microphone reconnected');
          } catch (err) {
            console.error('Failed to resume microphone:', err);
            // Show user-friendly error if permission denied
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
              alert('Microphone permission denied. Please allow microphone access to use the tuner.');
            }
          }
        }
      }
    });

    console.log("Tuner started!");
  } catch (e) {
    console.error("Failed to start tuner:", e);
    document.body.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Error: ${e}</div>`;
  }
}


// Initial UI
document.querySelector('#app')!.innerHTML = `
  <div class="start-container">
    <h1>Pure Tone</h1>
    <p class="version-label">v${pkg.version}</p>
    <button id="start-btn" class="start-button">
      Start Tuner
    </button>
  </div>
`;

document.querySelector('#start-btn')?.addEventListener('click', async () => {
  await startTuner();
});
