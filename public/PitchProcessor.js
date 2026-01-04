/**
 * PitchProcessor.js
 * A standalone, zero-dependency AudioWorkletProcessor for pitch detection.
 * Implements the McLeod Pitch Method (MPM).
 */
class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.sampleRate = sampleRate;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    const inputLength = channelData.length;

    // Fill buffer
    for (let i = 0; i < inputLength; i++) {
      this.buffer[this.bufferIndex] = channelData[i];
      this.bufferIndex++;

      if (this.bufferIndex >= this.bufferSize) {
        this.detectPitch();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  detectPitch() {
    const buffer = this.buffer;
    const size = this.bufferSize;
    
    // 1. Calculate RMS (Volume) for silence detection
    let sumSquares = 0;
    for (let i = 0; i < size; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / size);

    // 2. McLeod Pitch Method (MPM) - Simplified NSDF
    // We only compute NSDF for lags up to half buffer size
    const maxLag = Math.floor(size / 2);
    const nsdf = new Float32Array(maxLag);

    for (let tau = 0; tau < maxLag; tau++) {
      let acf = 0;
      let divisorM = 0;

      for (let i = 0; i < size - tau; i++) {
        acf += buffer[i] * buffer[i + tau];
        divisorM += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
      }
      
      nsdf[tau] = 2 * acf / divisorM;
    }

    // 3. Peak Picking
    const peaks = [];
    let pos = 0;
    let curMaxPos = 0;
    let nsdfMax = -1;
    
    // Find key maxima
    for (let i = 1; i < maxLag - 1; i++) {
        if (nsdf[i] > nsdf[i-1] && nsdf[i] >= nsdf[i+1]) {
            if (pos === 0) {
                 pos = i; // first peak
            } 
        }
    }

    // A simpler peak picking strategy for tuner accuracy:
    // Find the highest peak after the first zero crossing or significant dip
    // For MPM, we usually look for the first peak above a threshold (clarity).
    
    let cutoff = 0.90; // High confidence needed for tuner
    let periodIndex = -1;
    let clarity = 0;

    // Search for first major peak
    for (let i = 1; i < maxLag - 1; i++) {
        // Is it a local maximum?
        if (nsdf[i] > nsdf[i-1] && nsdf[i] >= nsdf[i+1]) {
             if (nsdf[i] > cutoff) {
                 periodIndex = i;
                 clarity = nsdf[i];
                 break; // Found the fundamental
             }
        }
    }

    // If no peak found with high cutoff, try lower, but report lower clarity
    if (periodIndex === -1) {
        cutoff = 0.7;
        for (let i = 1; i < maxLag - 1; i++) {
            if (nsdf[i] > nsdf[i-1] && nsdf[i] >= nsdf[i+1]) {
                 if (nsdf[i] > cutoff) {
                     // We take the highest peak overall if we drop standards
                     if (nsdf[i] > clarity) {
                         clarity = nsdf[i];
                         periodIndex = i;
                     }
                 }
            }
        }
    }

    let pitch = null;

    if (periodIndex !== -1) {
      // 4. Parabolic Interpolation for precision
      const y1 = nsdf[periodIndex - 1];
      const y2 = nsdf[periodIndex];
      const y3 = nsdf[periodIndex + 1];
      
      const refinedLag = periodIndex + (y3 - y1) / (2 * (2 * y2 - y3 - y1));
      pitch = this.sampleRate / refinedLag;
    }

    // Post result
    this.port.postMessage({
      pitch: pitch,
      clarity: clarity,
      bufferrms: rms
    });
  }
}

registerProcessor('pitch-processor', PitchProcessor);