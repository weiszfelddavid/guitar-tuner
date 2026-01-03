const fs = require('fs');
const wav = require('wav');

// --- Configuration ---
const SAMPLE_RATE = 48000;
const DURATION_SEC = 1.5; // Duration for each note
const SILENCE_SEC = 0.5;   // Silence between notes
const FILENAME = 'tests/e2e/fixtures/melody.wav';

// --- Notes (Hz) ---
const FREQUENCIES = {
  E2: 82.41,
  A2: 110.00,
  D3: 146.83,
  G3: 196.00,
};

// --- Wave Generation ---
function generateSineWave(freq, duration, sampleRate) {
  const numSamples = duration * sampleRate;
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    // Volume fade-out for a more realistic pluck
    const amplitude = Math.max(0, 1.0 - (i / numSamples)); 
    const value = Math.sin((2 * Math.PI * freq * i) / sampleRate) * amplitude;
    samples.push(value);
  }
  return samples;
}

function generateSilence(duration, sampleRate) {
  return new Array(duration * sampleRate).fill(0);
}

// --- Main Script ---
console.log('Generating audio fixture...');

let allSamples = [];

// Generate melody with silence in between
const notes = ['E2', 'A2', 'D3', 'G3'];
notes.forEach(note => {
  console.log(`- Adding note: ${note} (${FREQUENCIES[note]} Hz)`);
  allSamples = allSamples.concat(generateSineWave(FREQUENCIES[note], DURATION_SEC, SAMPLE_RATE));
  allSamples = allSamples.concat(generateSilence(SILENCE_SEC, SAMPLE_RATE));
});


// Convert to 16-bit signed integer PCM for wider compatibility
const pcmSamples = new Int16Array(allSamples.length);
for (let i = 0; i < allSamples.length; i++) {
  // Scale float from [-1, 1] to 16-bit integer range [-32768, 32767]
  pcmSamples[i] = allSamples[i] * 32767;
}
const buffer = Buffer.from(pcmSamples.buffer);

const file = fs.createWriteStream(FILENAME);
const writer = new wav.Writer({
  sampleRate: SAMPLE_RATE,
  channels: 1,
  bitDepth: 16,
  float: false,
});

writer.pipe(file);
writer.write(buffer);
writer.end();

console.log(`
✅ Audio fixture generated at: ${FILENAME}`);
