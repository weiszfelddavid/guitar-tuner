/**
 * PitchProcessor.js
 * A standalone, zero-dependency AudioWorkletProcessor for pitch detection.
 * Implements the McLeod Pitch Method (MPM) with adaptive buffering and visualization.
 */
class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // Default to Guitar/Uke speed
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.sampleRate = sampleRate;
    
    // Visualization buffer (downsampled)
    this.visualSize = 256;
    this.visualBuffer = new Float32Array(this.visualSize);
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'set-buffer-size') {
        this.setBufferSize(event.data.size);
      }
    };
  }
  
  setBufferSize(newSize) {
    if (newSize !== this.bufferSize) {
      this.bufferSize = newSize;
      this.buffer = new Float32Array(newSize);
      this.bufferIndex = 0;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    const inputLength = channelData.length;

    // Fill buffer
    for (let i = 0; i < inputLength; i++) {
      if (this.bufferIndex < this.bufferSize) {
        this.buffer[this.bufferIndex] = channelData[i];
        this.bufferIndex++;
      }

      if (this.bufferIndex >= this.bufferSize) {
        this.processBuffer();
        this.bufferIndex = 0;
      }
    }

    return true;
  }
  
  processBuffer() {
    const buffer = this.buffer;
    const size = this.bufferSize;
    
    // 1. Generate Waveform for UI (Downsample to visualSize)
    // Simple linear subsampling is sufficient for visualizer
    const step = Math.floor(size / this.visualSize);
    for (let i = 0; i < this.visualSize; i++) {
      this.visualBuffer[i] = buffer[i * step];
    }
    
    // 2. Calculate RMS (Volume)
    let sumSquares = 0;
    for (let i = 0; i < size; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / size);

    // 3. McLeod Pitch Method (MPM) - Simplified NSDF
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

    // 4. Peak Picking
    let periodIndex = -1;
    let clarity = 0;
    let cutoff = 0.90;

    // Search for first major peak
    for (let i = 1; i < maxLag - 1; i++) {
        if (nsdf[i] > nsdf[i-1] && nsdf[i] >= nsdf[i+1]) {
             if (nsdf[i] > cutoff) {
                 periodIndex = i;
                 clarity = nsdf[i];
                 break; // Found the fundamental
             }
        }
    }

    // Fallback search
    if (periodIndex === -1) {
        cutoff = 0.7;
        for (let i = 1; i < maxLag - 1; i++) {
            if (nsdf[i] > nsdf[i-1] && nsdf[i] >= nsdf[i+1]) {
                 if (nsdf[i] > cutoff) {
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
      // 5. Parabolic Interpolation
      const y1 = nsdf[periodIndex - 1];
      const y2 = nsdf[periodIndex];
      const y3 = nsdf[periodIndex + 1];
      
      const refinedLag = periodIndex + (y3 - y1) / (2 * (2 * y2 - y3 - y1));
      pitch = this.sampleRate / refinedLag;
    }

    // Post result with waveform
    this.port.postMessage({
      pitch: pitch,
      clarity: clarity,
      bufferrms: rms,
      waveform: this.visualBuffer // Send the visual data
    });
  }
}

registerProcessor('pitch-processor', PitchProcessor);