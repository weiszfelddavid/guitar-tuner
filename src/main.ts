// TEMPORARY: On-screen console for mobile debugging
(function () {
  const out: string[] = [];
  const show = () => {
    document.body.innerHTML =
      '<pre style="white-space:pre-wrap;font-size:12px;padding:10px;background:#000;color:#0f0;margin:0;height:100vh;overflow:auto">' +
      out.join('\n') +
      '</pre>';
  };

  const log = (...a: any[]) => {
    out.push(a.map(x => String(x)).join(' '));
    if (out.length > 200) out.shift(); // Keep last 200 lines
    show();
  };

  console.log = log;
  console.error = log;
  console.warn = log;
  (window as any).onerror = (m: any, s: any, l: any, c: any, e: any) => log('ERROR', m, e?.stack || '');
  (window as any).onunhandledrejection = (e: any) => log('PROMISE REJECT', e.reason);
})();

import './style.css';
import { getAudioContext, getMicrophoneStream } from './audio/setup';
import { createTunerWorklet } from './audio/worklet';
import { TunerCanvas } from './ui/canvas';
import { KalmanFilter, TunerState, TunerMode, TunerConfig, getDefaultConfig } from './ui/tuner';
import {
  ATTACK_SMOOTHING_FACTOR,
  KALMAN_MEASUREMENT_NOISE,
  AUDIO_CONTEXT_CHECK_INTERVAL_MS,
  WASM_INIT_TIMEOUT_MS
} from './constants/tuner-config';
import { initDebugConsole } from './ui/debug-console';
import { StringSelector } from './ui/string-selector';
import pkg from '../package.json';

// Enable on-screen debugging for mobile
initDebugConsole();

// Mode management with local storage
const STORAGE_KEY_MODE = 'tuner:mode';
let currentMode: TunerMode = (localStorage.getItem(STORAGE_KEY_MODE) as TunerMode) || 'strict';

// Centralized configuration - updated when mode changes
let currentConfig: TunerConfig = getDefaultConfig(currentMode);

function setMode(mode: TunerMode, tunerNode?: AudioWorkletNode) {
    currentMode = mode;
    localStorage.setItem(STORAGE_KEY_MODE, mode);

    // Update centralized configuration
    currentConfig = getDefaultConfig(mode);
    kalman.setProcessNoise(currentConfig.smoothingFactor);

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
let currentState: TunerState = { noteName: '--', cents: 0, clarity: 0, volume: 0, isLocked: false, frequency: 0, isAttacking: false };
const kalman = new KalmanFilter(currentConfig.smoothingFactor, KALMAN_MEASUREMENT_NOISE);
let stringSelector: StringSelector | null = null;
let smoothedCents = 0;

// Expose state for testing (dev/test only)
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    window.getTunerState = () => currentState;
}

/**
 * Error recovery configuration for WASM loading
 */
const WASM_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * Retry a promise-based operation with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  attempt: number = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= WASM_RETRY_CONFIG.maxAttempts) {
      throw error; // Max attempts reached
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      WASM_RETRY_CONFIG.initialDelayMs * Math.pow(WASM_RETRY_CONFIG.backoffMultiplier, attempt - 1),
      WASM_RETRY_CONFIG.maxDelayMs
    );

    console.warn(`${operationName} failed (attempt ${attempt}/${WASM_RETRY_CONFIG.maxAttempts}). Retrying in ${delay}ms...`);
    console.warn('Error:', error);

    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(operation, operationName, attempt + 1);
  }
}

/**
 * Categorize WASM loading errors for better user messaging
 */
function categorizeWasmError(error: unknown): { category: string; message: string; technicalDetails: string; suggestions: string[] } {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Network errors
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    return {
      category: 'network',
      message: 'Unable to download audio engine',
      technicalDetails: errorMessage,
      suggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Check if your firewall is blocking the connection'
      ]
    };
  }

  // Content-Type errors
  if (errorMessage.includes('Content-Type')) {
    return {
      category: 'server',
      message: 'Server configuration issue',
      technicalDetails: errorMessage,
      suggestions: [
        'The server is not configured correctly',
        'Try again later',
        'Contact support if the problem persists'
      ]
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout')) {
    return {
      category: 'timeout',
      message: 'Audio engine initialization timed out',
      technicalDetails: errorMessage,
      suggestions: [
        'Your device may be slow or busy',
        'Close other browser tabs',
        'Try again'
      ]
    };
  }

  // Compilation errors
  if (errorMessage.includes('CompileError') || errorMessage.includes('LinkError')) {
    return {
      category: 'compatibility',
      message: 'Browser compatibility issue',
      technicalDetails: errorMessage,
      suggestions: [
        'Your browser may not support WebAssembly',
        'Try updating your browser',
        'Try a different browser (Chrome, Firefox, Edge)'
      ]
    };
  }

  // Generic error
  return {
    category: 'unknown',
    message: 'Failed to load audio engine',
    technicalDetails: errorMessage,
    suggestions: [
      'Try refreshing the page',
      'Clear your browser cache',
      'Try a different browser'
    ]
  };
}

/**
 * Show a user-friendly error dialog with retry option
 */
function showErrorDialog(errorInfo: ReturnType<typeof categorizeWasmError>, onRetry: () => void): void {
  // Remove any existing error dialogs
  document.querySelectorAll('.error-dialog').forEach(el => el.remove());

  const dialog = document.createElement('div');
  dialog.className = 'error-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1a1a1a;
    border: 2px solid #ff5555;
    border-radius: 12px;
    padding: 32px;
    max-width: 500px;
    width: 90%;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    font-family: sans-serif;
    color: white;
  `;

  dialog.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h2 style="margin: 0 0 16px 0; color: #ff5555; font-size: 24px;">${errorInfo.message}</h2>
      <div style="text-align: left; margin-bottom: 24px;">
        <p style="margin: 8px 0; color: #cccccc;">What you can try:</p>
        <ul style="margin: 8px 0; padding-left: 24px; color: #aaaaaa;">
          ${errorInfo.suggestions.map(s => `<li style="margin: 4px 0;">${s}</li>`).join('')}
        </ul>
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="retry-btn" style="
          background: var(--color-accent, #4a9eff);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.1s, background 0.2s;
        ">↻ Retry</button>
        <button id="details-btn" style="
          background: transparent;
          color: #888888;
          border: 1px solid #444444;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: border-color 0.2s;
        ">Technical Details</button>
      </div>
      <details style="margin-top: 24px; text-align: left; display: none;" id="tech-details">
        <summary style="cursor: pointer; color: #888888; margin-bottom: 8px;">Technical Information</summary>
        <pre style="
          background: #0a0a0a;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
          color: #ff8888;
          margin: 0;
        ">${errorInfo.technicalDetails}</pre>
      </details>
    </div>
  `;

  document.body.appendChild(dialog);

  // Add event listeners
  const retryBtn = dialog.querySelector('#retry-btn') as HTMLButtonElement;
  const detailsBtn = dialog.querySelector('#details-btn') as HTMLButtonElement;
  const techDetails = dialog.querySelector('#tech-details') as HTMLDetailsElement;

  retryBtn.addEventListener('click', () => {
    dialog.remove();
    onRetry();
  });

  retryBtn.addEventListener('mouseenter', () => {
    retryBtn.style.transform = 'scale(1.05)';
  });

  retryBtn.addEventListener('mouseleave', () => {
    retryBtn.style.transform = 'scale(1)';
  });

  detailsBtn.addEventListener('click', () => {
    techDetails.style.display = 'block';
    detailsBtn.style.display = 'none';
  });

  detailsBtn.addEventListener('mouseenter', () => {
    detailsBtn.style.borderColor = '#666666';
  });

  detailsBtn.addEventListener('mouseleave', () => {
    detailsBtn.style.borderColor = '#444444';
  });
}

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

    // Create AudioWorklet with verification handshake
    let tunerNode: AudioWorkletNode;
    try {
      tunerNode = await createTunerWorklet(context);
    } catch (workletError) {
      console.error("Failed to create AudioWorklet:", workletError);

      // Show specific error for worklet failure
      const errorInfo = {
        category: 'audioworklet',
        message: 'Failed to initialize audio processor',
        technicalDetails: workletError instanceof Error ? workletError.message : String(workletError),
        suggestions: [
          'The audio processor failed to register or initialize properly',
          'This may be due to slow network connection or browser compatibility',
          'Try refreshing the page',
          'Clear your browser cache and try again',
          'Try a different browser (Chrome or Edge recommended)',
        ]
      };

      showErrorDialog(errorInfo, async () => {
        // Retry the full initialization
        await startTuner();
      });

      return; // Don't continue with initialization
    }

    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: sans-serif;
    `;

    const loadingText = document.createElement('div');
    loadingText.style.cssText = `
        font-size: 18px;
        margin-top: 20px;
        color: rgba(255, 255, 255, 0.9);
    `;
    loadingText.textContent = 'Initializing tuner...';

    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-top: 4px solid var(--color-accent, #4a9eff);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    `;

    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    loadingOverlay.appendChild(spinner);
    loadingOverlay.appendChild(loadingText);
    document.body.appendChild(loadingOverlay);

    // Load WASM with automatic retry and error recovery
    let wasmInitialized = false;

    const loadWasmWithRetry = async (): Promise<void> => {
      // Listen for WASM initialization confirmation from worklet
      const wasmInitPromise = new Promise<void>((resolve, reject) => {
        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'log' && event.data.message.includes('WASM initialized successfully')) {
            wasmInitialized = true;
            tunerNode.port.removeEventListener('message', messageHandler);
            resolve();
          }
        };
        tunerNode.port.addEventListener('message', messageHandler);

        // Add timeout to reject promise if initialization takes too long
        setTimeout(() => {
          tunerNode.port.removeEventListener('message', messageHandler);
          reject(new Error('WASM initialization timeout'));
        }, WASM_INIT_TIMEOUT_MS);
      });

      // Wrap WASM loading in retry logic
      await retryWithBackoff(async () => {
        loadingText.textContent = 'Loading audio engine...';
        console.log("Loading WASM from main thread...");

        const wasmRes = await fetch('/pure_tone_bg.wasm');
        if (!wasmRes.ok) {
          throw new Error(`Failed to fetch WASM: ${wasmRes.status} ${wasmRes.statusText}`);
        }

        const contentType = wasmRes.headers.get('Content-Type');
        if (contentType && !contentType.includes('wasm')) {
          throw new Error(`Invalid Content-Type for WASM: ${contentType} (Expected application/wasm)`);
        }

        loadingText.textContent = 'Initializing audio processor...';
        const wasmBuffer = await wasmRes.arrayBuffer();
        tunerNode.port.postMessage({ type: 'load-wasm', wasmBytes: wasmBuffer }, [wasmBuffer]);
        console.log("WASM sent to worklet");

        // Wait for worklet to confirm initialization
        await wasmInitPromise;

        loadingText.textContent = 'Ready!';
        console.log("WASM initialization confirmed");
      }, 'WASM loading');
    };

    try {
      await loadWasmWithRetry();
    } catch (e) {
      console.error("WASM Load Error (all retry attempts failed):", e);

      // Remove loading overlay
      loadingOverlay.remove();

      // Show user-friendly error dialog with retry option
      const errorInfo = categorizeWasmError(e);
      showErrorDialog(errorInfo, async () => {
        // User clicked retry - show loading overlay again and try
        document.body.appendChild(loadingOverlay);
        loadingText.textContent = 'Retrying...';
        loadingText.style.color = 'rgba(255, 255, 255, 0.9)';

        try {
          await loadWasmWithRetry();
          // Success! Remove overlay and continue
          setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.transition = 'opacity 0.3s';
            setTimeout(() => loadingOverlay.remove(), 300);
          }, 300);
        } catch (retryError) {
          // Failed again, show error dialog
          loadingOverlay.remove();
          const retryErrorInfo = categorizeWasmError(retryError);
          showErrorDialog(retryErrorInfo, () => location.reload()); // Full page reload on second failure
        }
      });

      // Don't continue initialization if WASM failed
      return;
    }

    // Send initial mode to worklet
    tunerNode.port.postMessage({ type: 'set-mode', mode: currentMode });

    // Remove loading overlay
    setTimeout(() => {
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.transition = 'opacity 0.3s';
        setTimeout(() => loadingOverlay.remove(), 300);
    }, 300);

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

    // Re-append debug console if it was wiped (DEV only)
    if (import.meta.env.DEV) {
        const debugConsole = document.getElementById('debug-console');
        if (debugConsole) {
            document.body.appendChild(debugConsole); // Move to end to ensure z-index
        }
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

    // Add debug console toggle button next to mode toggle (DEV only)
    if (import.meta.env.DEV) {
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
            const isDebugVisible = localStorage.getItem('tuner:debug') === 'true';
            const label = document.getElementById('debug-label');
            if (label) {
                label.textContent = isDebugVisible ? 'Visible' : 'Hidden';
            }
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
    setInterval(checkState, AUDIO_CONTEXT_CHECK_INTERVAL_MS);

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

          // Attack-aware Kalman filter for visual needle smoothing
          // Fast response during pluck attacks, slow during sustain
          kalman.setProcessNoise(currentState.isAttacking ? ATTACK_SMOOTHING_FACTOR : currentConfig.smoothingFactor);

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

    // 5. Handle Page Visibility (suspend AudioContext but keep MediaStream)
    let isConnected = true;

    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        // Tab went to background - suspend processing but keep microphone permission
        console.log('Tab hidden - suspending audio processing');
        if (isConnected) {
          // Disconnect from audio processing to stop worklet
          source.disconnect();
          isConnected = false;

          // Reset visual state to show no note
          currentState = { noteName: '--', cents: 0, clarity: 0, volume: 0, isLocked: false, frequency: 0, isAttacking: false };
          smoothedCents = 0;
        }

        // Suspend audio context to save CPU/battery
        if (context.state === 'running') {
          await context.suspend();
          console.log('AudioContext suspended');
        }
      } else {
        // Tab came to foreground - resume audio processing
        console.log('Tab visible - resuming audio processing');
        if (!isConnected) {
          try {
            // Resume audio context first
            if (context.state === 'suspended') {
              await context.resume();
              console.log('AudioContext resumed');
            }

            // Reconnect existing MediaStream (no new permission needed)
            source.connect(tunerNode);
            isConnected = true;
            console.log('Audio processing reconnected');
          } catch (err) {
            console.error('Failed to resume audio processing:', err);
          }
        }
      }
    });

    console.log("Tuner started!");
  } catch (e) {
    console.error("Failed to start tuner:", e);

    // Parse specific errors for better user messaging
    let errorInfo;

    if (e instanceof Error && (e.message.includes('tuner-processor') || e.message.includes('AudioWorklet'))) {
      // Specific AudioWorklet registration error
      errorInfo = {
        category: 'audioworklet',
        message: 'Audio processor failed to initialize',
        technicalDetails: e.message,
        suggestions: [
          'The audio processor failed to register in your browser',
          'This is often caused by slow network connections',
          'Try refreshing the page and waiting a bit longer',
          'Clear your browser cache and reload',
          'Try a different browser (Chrome, Firefox, or Edge recommended)'
        ]
      };
    } else if (e instanceof Error && e.name === 'NotAllowedError') {
      // Microphone permission denied
      errorInfo = {
        category: 'permission',
        message: 'Microphone access denied',
        technicalDetails: e.message,
        suggestions: [
          'Click the camera/microphone icon in your browser\'s address bar',
          'Allow microphone access for this site',
          'Refresh the page after granting permission',
          'Check your system microphone permissions'
        ]
      };
    } else if (e instanceof Error && e.name === 'NotFoundError') {
      // No microphone found
      errorInfo = {
        category: 'hardware',
        message: 'No microphone detected',
        technicalDetails: e.message,
        suggestions: [
          'Connect a microphone to your device',
          'Check your system audio settings',
          'Make sure your microphone is enabled',
          'Try a different microphone if available'
        ]
      };
    } else if (e instanceof Error && e.name === 'NotSupportedError') {
      // Browser doesn't support required features
      errorInfo = {
        category: 'compatibility',
        message: 'Browser does not support required features',
        technicalDetails: e.message,
        suggestions: [
          'Your browser may not support WebAudio API or AudioWorklets',
          'Try updating your browser to the latest version',
          'Try a modern browser (Chrome, Firefox, or Edge)',
          'Check if your browser has WebAudio disabled'
        ]
      };
    } else {
      // Generic error
      errorInfo = {
        category: 'startup',
        message: 'Failed to start tuner',
        technicalDetails: e instanceof Error ? e.message : String(e),
        suggestions: [
          'Check that your browser supports audio',
          'Make sure you granted microphone permission',
          'Try refreshing the page',
          'Clear your browser cache',
          'Try a different browser'
        ]
      };
    }

    showErrorDialog(errorInfo, () => {
      // Retry by reloading the page
      location.reload();
    });
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
