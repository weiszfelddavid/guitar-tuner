// Polyfill for AudioWorklet environment where self.location might be missing
if (typeof self.location === 'undefined') {
  self.location = { href: '' };
}
if (typeof self.window === 'undefined') {
    self.window = self;
}
if (typeof self.XMLHttpRequest === 'undefined') {
    self.XMLHttpRequest = function() {};
}

importScripts('aubio.js');

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pitch = null;
    this.buffer = new Float32Array(512);
    this.bufferIndex = 0;
    
    aubio().then((Aubio) => {
      this.pitch = new Aubio.Pitch('default', 2048, 512, sampleRate);
    }).catch(err => {
      console.error('Failed to initialize aubio:', err);
    });
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    
    const channelData = input[0];
    
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];
      
      if (this.bufferIndex >= this.buffer.length) {
        // Calculate RMS
        let sumSquares = 0;
        for (let j = 0; j < this.buffer.length; j++) {
            sumSquares += this.buffer[j] * this.buffer[j];
        }
        const rms = Math.sqrt(sumSquares / this.buffer.length);

        if (this.pitch) {
          const frequency = this.pitch.do(this.buffer);
          // Fallback for confidence if getConfidence is not available
          const confidence = typeof this.pitch.getConfidence === 'function' ? this.pitch.getConfidence() : 1.0;
          
          this.port.postMessage({
            pitch: frequency,
            clarity: confidence,
            bufferrms: rms
          });
        }
        this.bufferIndex = 0;
      }
    }
    
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
