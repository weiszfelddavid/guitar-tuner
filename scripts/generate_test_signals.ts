import fs from 'fs';
import path from 'path';

// Standard Audio Constants
const SAMPLE_RATE = 48000;
const BUFFER_SIZE = 48000 * 3; // 3 seconds

function generateSineWave(freq: number, durationSec: number, amplitude: number = 0.5): Float32Array {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = amplitude * Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE));
  }
  return buffer;
}

function generateNoise(durationSec: number, amplitude: number = 0.1): Float32Array {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return buffer;
}

function createTestScenario_Pluck(): Float32Array {
  const buffer = new Float32Array(SAMPLE_RATE * 2); // 2 seconds
  
  // 0.0 - 0.5s: Silence
  // 0.5 - 0.7s: Sharp Attack (85Hz, Loud)
  // 0.7 - 2.0s: Sustain (82.4Hz, Decaying)

  for (let i = 0; i < buffer.length; i++) {
    const t = i / SAMPLE_RATE;
    if (t < 0.5) {
      buffer[i] = 0;
    } else if (t < 0.7) {
      // Attack: 85Hz, Amp 0.8
      buffer[i] = 0.8 * Math.sin(2 * Math.PI * 85 * t);
    } else {
      // Sustain: 82.4Hz, Amp decays from 0.6 to 0.2
      const decay = 0.6 * Math.exp(-(t - 0.7)); 
      buffer[i] = decay * Math.sin(2 * Math.PI * 82.41 * t);
    }
  }
  return buffer;
}

// Ensure output directory exists
const outDir = path.resolve(__dirname, '../tests/fixtures');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Write to JSON files for easy import in Vitest
// (WAV encoding is overkill for internal testing)
const pluckBuffer = createTestScenario_Pluck();
fs.writeFileSync(
  path.join(outDir, 'pluck_E2.json'), 
  JSON.stringify(Array.from(pluckBuffer))
);

function createTestScenario_NoisyPitch(): number[] {
  // Simulate pitch values, not audio buffer
  // 10 samples of stable 82.41
  // 1 sample of OUTLIER 110.00
  // 10 samples of stable 82.41
  const pitches = [];
  for(let i=0; i<30; i++) {
      if (i === 15) {
          pitches.push(110.00); // Random spike
      } else {
          pitches.push(82.41 + (Math.random() * 0.2 - 0.1)); // Tiny jitter
      }
  }
  return pitches;
}

const noisyPitch = createTestScenario_NoisyPitch();
fs.writeFileSync(
  path.join(outDir, 'pitch_noisy.json'),
  JSON.stringify(noisyPitch)
);

console.log('Generated test signals in tests/fixtures/');
