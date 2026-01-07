import './style.css';
import { getAudioContext, getMicrophoneStream } from './audio/setup';
import { createTunerWorklet } from './audio/worklet';
import { TunerCanvas } from './ui/canvas';
import { getTunerState, KalmanFilter, TunerState } from './ui/tuner';

// State management
let currentState: TunerState = { noteName: '--', cents: 0, clarity: 0, isLocked: false };
const kalman = new KalmanFilter(0.1, 0.1); 
// We use a separate smoothed value for the needle to keep it fluid
let smoothedCents = 0;

async function startTuner() {
  try {
    // 1. Setup Audio
    const context = await getAudioContext();
    const micStream = await getMicrophoneStream(context);
    const source = context.createMediaStreamSource(micStream);
    const tunerNode = await createTunerWorklet(context);
    
    // 2. Setup UI
    document.body.innerHTML = '<canvas id="tuner-canvas"></canvas>';
    const canvas = new TunerCanvas('tuner-canvas');
    
    // 3. Audio Loop
    tunerNode.port.onmessage = (event) => {
      const { pitch, clarity } = event.data;
      currentState = getTunerState(pitch, clarity);
      
      // Reset filter if we lose signal or switch notes abruptly?
      // For now, we just feed the filter.
      // If note changes, the cents jump. The filter will smooth the jump. 
      // This is desirable for "fluidity", but maybe too slow?
      // Let's refine: if note changes, reset filter?
      // Actually, if note changes, cents might wrap around or jump large values.
      // But getTunerState handles note logic. 
      // If we go from E to A, cents recalculates based on A.
      
      // We only smooth valid readings.
      if (currentState.noteName !== '--') {
          smoothedCents = kalman.filter(currentState.cents);
      } else {
          // Decay to 0 or hold?
          // Let's reset needle to 0 slowly or just keep last known?
          // For UX, dropping to 0 when silence is good.
          smoothedCents = kalman.filter(0);
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