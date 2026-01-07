import './style.css';
import { getAudioContext, getMicrophoneStream } from './audio/setup';
import { createTunerWorklet } from './audio/worklet';
import { TunerCanvas } from './ui/canvas';
import { getTunerState, KalmanFilter, TunerState } from './ui/tuner';
import { initDebugConsole } from './ui/debug-console';

// Enable on-screen debugging for mobile
initDebugConsole();

// State management
let currentState: TunerState = { noteName: '--', cents: 0, clarity: 0, volume: 0, isLocked: false };
const kalman = new KalmanFilter(0.1, 0.1); 
// We use a separate smoothed value for the needle to keep it fluid
let smoothedCents = 0;

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
    
    const micStream = await getMicrophoneStream(context);
    
    // Log active settings to debug "Silence" issue
    const track = micStream.getAudioTracks()[0];
    if (track) {
        console.log("Mic Label:", track.label);
        console.log("Mic Settings:", JSON.stringify(track.getSettings(), null, 2));
        console.log("Mic Constraints:", JSON.stringify(track.getConstraints(), null, 2));
    } else {
        console.error("No audio track found in stream!");
    }

    // FIX 2: Check resume AGAIN after permission prompt (which might have broken the user gesture chain)

    
    // 2. Setup UI
    document.body.innerHTML = '<canvas id="tuner-canvas"></canvas>';
    const canvas = new TunerCanvas('tuner-canvas');

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
    
    // 3. Audio Loop
    tunerNode.port.onmessage = (event) => {
      const { pitch, clarity, volume } = event.data;
      currentState = getTunerState(pitch, clarity, volume || 0);
      
      // We only smooth valid readings.
      if (currentState.noteName !== '--') {
          smoothedCents = kalman.filter(currentState.cents);
      } else {
          // Decay needle to 0
          smoothedCents = kalman.filter(0);
      }
    };

    source.connect(tunerNode);
    // Keep connection to destination to prevent Garbage Collection, 
    // but typically we don't want feedback. 
    // If TunerProcessor doesn't output audio to output buffer, this is safe.
    tunerNode.connect(context.destination); 
 

    // 4. Render Loop
    const render = () => {
      canvas.render(currentState, smoothedCents);
      requestAnimationFrame(render);
    };
    render();
    
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
    <button id="start-btn" class="start-button">
      Start Tuner
    </button>
  </div>
`;

document.querySelector('#start-btn')?.addEventListener('click', async () => {
  await startTuner();
});