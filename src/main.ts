import './style.css';
import { getAudioContext, getMicrophoneStream } from './audio/setup';
import { createTunerWorklet } from './audio/worklet';
import { TunerCanvas } from './ui/canvas';
import { getTunerState, KalmanFilter, TunerState } from './ui/tuner';

// State management
let currentState: TunerState = { noteName: '--', cents: 0, clarity: 0, volume: 0, isLocked: false };
const kalman = new KalmanFilter(0.1, 0.1); 
// We use a separate smoothed value for the needle to keep it fluid
let smoothedCents = 0;

async function startTuner() {
  try {
    // 1. Setup Audio
    const context = await getAudioContext();
    
    // FIX: Force resume AudioContext if it's suspended (Common on Android/iOS)
    if (context.state === 'suspended') {
      console.log("AudioContext suspended, resuming...");
      await context.resume();
    }
    console.log("AudioContext State:", context.state);

    const micStream = await getMicrophoneStream(context);
    const source = context.createMediaStreamSource(micStream);
    const tunerNode = await createTunerWorklet(context);
    
    // 2. Setup UI
    document.body.innerHTML = '<canvas id="tuner-canvas"></canvas>';
    const canvas = new TunerCanvas('tuner-canvas');
    
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