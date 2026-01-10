// TEMPORARY: On-screen console for mobile debugging
(function () {
  const out: string[] = ['[LOGGER] Starting on-screen logger...'];
  let pre: HTMLPreElement | null = null;

  const ensurePre = () => {
    if (!pre && document.body) {
      pre = document.createElement('pre');
      pre.style.cssText = 'white-space:pre-wrap;font-size:11px;padding:8px;background:rgba(0,0,0,0.95);color:#0f0;margin:0;position:fixed;top:0;left:0;width:100%;height:50%;overflow:auto;z-index:999999;border-bottom:2px solid #0f0;transition:height 0.3s ease;';
      document.body.appendChild(pre);

      // Add collapse/expand button
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = 'Collapse Logs';
      toggleBtn.style.cssText = 'position:fixed;top:5px;right:5px;z-index:1000000;padding:4px 8px;font-size:10px;background:#333;color:white;border:1px solid #666;border-radius:4px;cursor:pointer;';
      
      let isCollapsed = false;
      toggleBtn.onclick = () => {
        isCollapsed = !isCollapsed;
        if (pre) {
          pre.style.height = isCollapsed ? '30px' : '50%';
          pre.style.overflow = isCollapsed ? 'hidden' : 'auto';
        }
        toggleBtn.textContent = isCollapsed ? 'Expand Logs' : 'Collapse Logs';
      };
      document.body.appendChild(toggleBtn);

      out.push('[LOGGER] Pre element created and appended to body');
      if (pre) pre.textContent = out.join('\n');
    }
  };

  const show = () => {
    ensurePre();
    if (pre) pre.textContent = out.join('\n');
  };

  const log = (...a: unknown[]) => {
    const msg = a.map(x => {
      try {
        return String(x);
      } catch (e) {
        return '[Unstringifiable]';
      }
    }).join(' ');
    out.push(msg);
    if (out.length > 200) out.shift(); // Keep last 200 lines
    show();
  };

  console.log = log;
  console.error = log;
  console.warn = log;
  window.onerror = (m: string | Event, s: string | undefined, l: number | undefined, c: number | undefined, e: Error | undefined) => {
    log('ERROR', m, e?.stack || e?.message || 'No error details');
  };
  window.onunhandledrejection = (e: PromiseRejectionEvent) => {
    log('PROMISE REJECT', e.reason?.stack || e.reason?.message || String(e.reason));
  };

  // Ensure pre exists when DOM loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensurePre();
      log('[LOGGER] DOMContentLoaded fired');
    });
  } else {
    ensurePre();
    log('[LOGGER] DOM already ready');
  }

  log('[LOGGER] Logger initialized');
})();

console.log('[MAIN] Importing modules...');

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
import { StringSelector } from './ui/string-selector';
import { MobileDebugOverlay } from './ui/mobile-debug-overlay';
import pkg from '../package.json';

console.log('[MAIN] All modules imported successfully');
console.log('[MAIN] Version:', pkg.version);

// Enable on-screen debugging for mobile
// initDebugConsole(); // DISABLED - using top-level logger instead

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
  const debugOverlay = new MobileDebugOverlay();
  debugOverlay.show();

  try {
    debugOverlay.log('1. Starting Audio Context...');
    const context = await getAudioContext();
    debugOverlay.success('Audio Context created');

    if (context.state === 'suspended') {
      debugOverlay.log('   Resuming suspended context...');
      await context.resume();
      debugOverlay.success('Audio Context resumed');
    }

    debugOverlay.log('2. Requesting microphone access...');
    let micStream = await getMicrophoneStream(context);
    debugOverlay.success('Microphone access granted');

    if (context.state === 'suspended') {
      await context.resume();
    }

    let source = context.createMediaStreamSource(micStream);

    debugOverlay.log('3. Loading worklet module...');
    let tunerNode: AudioWorkletNode;
    try {
      tunerNode = await createTunerWorklet(context);
      debugOverlay.success('Worklet initialized and ready');
    } catch (nodeError) {
      debugOverlay.error(
        'Failed to initialize worklet',
        nodeError instanceof Error ? nodeError.stack : String(nodeError)
      );
      return;
    }

    debugOverlay.log('4. Loading WASM JS glue code...');
    const glueRes = await fetch('/pure_tone_lib.mjs');
    if (!glueRes.ok) {
      debugOverlay.error('Failed to fetch WASM glue', `${glueRes.status} ${glueRes.statusText}`);
      return;
    }
    let glueCode = await glueRes.text();

    // Transform ES module exports to make code evaluable in worklet
    debugOverlay.log('   Transforming glue code...');
    glueCode = glueCode
      .replace(/export class PitchDetector/g, 'class PitchDetector')
      .replace(/export class TunerResult/g, 'class TunerResult')
      .replace(/export \{ initSync \};/g, 'globalThis.initSync = initSync;')
      .replace(/export default __wbg_init;/g, 'const default_init = __wbg_init;')
      // Also assign PitchDetector to globalThis after class definition
      + '\nglobalThis.PitchDetector = PitchDetector;';

    // Set up ONE persistent message handler for all worklet messages
    let glueResolve: () => void;
    let glueReject: (err: Error) => void;
    let wasmResolve: () => void;
    let wasmReject: (err: Error) => void;

    const glueTimeout = setTimeout(() => glueReject?.(new Error('Glue load timeout')), 5000);
    let wasmTimeout: ReturnType<typeof setTimeout>;

    const messageHandler = (event: MessageEvent) => {
      debugOverlay.log(`   [Main] Received: ${event.data.type}`);

      if (event.data.type === 'glue-loaded') {
        clearTimeout(glueTimeout);
        glueResolve();
      } else if (event.data.type === 'glue-error') {
        clearTimeout(glueTimeout);
        glueReject(new Error(event.data.error));
      } else if (event.data.type === 'wasm-ready') {
        clearTimeout(wasmTimeout);
        wasmResolve();
      } else if (event.data.type === 'wasm-error') {
        clearTimeout(wasmTimeout);
        wasmReject(new Error(event.data.error));
      } else if (event.data.type === 'debug') {
        debugOverlay.log(`   [Worklet] ${event.data.message}`);
      }
    };

    tunerNode.port.addEventListener('message', messageHandler);
    tunerNode.port.start();
    
    // Listen for processor errors (crashes, OOM, etc.)
    tunerNode.addEventListener('processorerror', (err) => {
      debugOverlay.error('Worklet crashed', `processorerror event received: ${JSON.stringify(err)}`);
      // Log more details if available
      console.error('[MAIN] Worklet processorerror:', err);
    });

    debugOverlay.log('   Sending glue code to worklet...');
    const glueLoadPromise = new Promise<void>((resolve, reject) => {
      glueResolve = resolve;
      glueReject = reject;
    });
    tunerNode.port.postMessage({ type: 'load-glue', glueCode });
    await glueLoadPromise;
    debugOverlay.success('Glue code loaded');

    debugOverlay.log('5. Fetching WASM module from server...');
    const wasmRes = await fetch('/pure_tone_bg.wasm');
    if (!wasmRes.ok) {
      debugOverlay.error('Failed to fetch WASM', `${wasmRes.status} ${wasmRes.statusText}`);
      return;
    }

    // We pass ArrayBuffer instead of Module to avoid potential structured clone issues
    // with WebAssembly.Module on some platforms/versions.
    // The glue code's initSync function handles ArrayBuffer by creating a Module from it.
    debugOverlay.log('   Downloading WASM binary...');
    const wasmBytes = await wasmRes.arrayBuffer();
    debugOverlay.success(`WASM binary downloaded (${wasmBytes.byteLength} bytes)`);

    debugOverlay.log('6. Sending WASM bytes to worklet...');
    const wasmInitPromise = new Promise<void>((resolve, reject) => {
      wasmResolve = resolve;
      wasmReject = reject;
    });
    wasmTimeout = setTimeout(() => wasmReject(new Error('WASM initialization timeout - Worklet did not respond in time')), WASM_INIT_TIMEOUT_MS);

    debugOverlay.log('   Posting load-wasm message to worklet...');
    tunerNode.port.postMessage({ type: 'load-wasm', wasmModule: wasmBytes });
    debugOverlay.log('   Message posted, waiting for response...');

    await wasmInitPromise;
    debugOverlay.success('WASM instantiated in worklet');

    tunerNode.port.postMessage({ type: 'set-mode', mode: currentMode });

    debugOverlay.log('7. Initializing UI...');
    debugOverlay.success('All systems ready!');
    setTimeout(() => debugOverlay.hide(), 2000);

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
        modeToggle.className = 'control-toggle';
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
            debugToggle.className = 'control-toggle';
            debugToggle.innerHTML = `
                <span class="mode-prefix">Logs:</span>
                <span id="debug-label">Hidden</span>
            `;
            document.body.appendChild(debugToggle);

            // Toggle debug console on click
            debugToggle.addEventListener('click', () => {
                const isVisible = window.toggleDebugConsole ? window.toggleDebugConsole() : false;
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

    debugOverlay.success('Tuner started!');
  } catch (e) {
    debugOverlay.error(
      'Failed to start tuner',
      e instanceof Error ? e.stack : String(e)
    );
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

const startBtn = document.querySelector('#start-btn');
console.log('[MAIN] Start button found:', startBtn ? 'YES' : 'NO');

if (startBtn) {
  startBtn.addEventListener('click', async () => {
    console.log('[MAIN] Start button clicked!');
    try {
      await startTuner();
      console.log('[MAIN] startTuner completed');
    } catch (err) {
      console.error('[MAIN] startTuner failed:', err);
    }
  });
}
