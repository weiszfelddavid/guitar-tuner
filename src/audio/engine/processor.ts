class PitchProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private bufferIndex: number = 0;
  private threshold: number = 0.1;

  constructor(options?: any) {
    super();
    // Default 2048 buffer size for good bass resolution
    const size = options?.processorOptions?.bufferSize || 2048;
    this.buffer = new Float32Array(size);
    this.threshold = options?.processorOptions?.threshold || 0.1;
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: any): boolean {
    const input = inputs[0];
    if (!input || !input.length) return true;
    
    const channel = input[0];
    // Simple ring buffer filling
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferIndex] = channel[i];
      this.bufferIndex++;
      
      if (this.bufferIndex >= this.buffer.length) {
        this.bufferIndex = 0;
        this.detectPitch();
      }
    }
    return true;
  }

  private detectPitch() {
    // YIN Algorithm Implementation
    const buffer = this.buffer;
    const bufferSize = buffer.length;
    const yinBuffer = new Float32Array(bufferSize / 2);
    
    // 1. Difference Function
    for (let tau = 0; tau < bufferSize / 2; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < bufferSize / 2; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // 2. Cumulative Mean Normalized Difference
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < bufferSize / 2; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // 3. Absolute Threshold
    let tauEstimate = -1;
    for (let tau = 2; tau < bufferSize / 2; tau++) {
      if (yinBuffer[tau] < this.threshold) {
        while (tau + 1 < bufferSize / 2 && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // 4. Report Results
    if (tauEstimate !== -1) {
      const pitch = 44100 / tauEstimate;
      
      // Calculate RMS for bufferrms
      let sumOfSquares = 0;
      for (let i = 0; i < bufferSize; i++) {
        sumOfSquares += buffer[i] * buffer[i];
      }
      const bufferrms = Math.sqrt(sumOfSquares / bufferSize);

      this.port.postMessage({
        pitch: pitch,
        clarity: 1 - yinBuffer[tauEstimate],
        bufferrms: bufferrms
      });
    } else {
      // If no pitch is detected, still send bufferrms for silence gate
      let sumOfSquares = 0;
      for (let i = 0; i < bufferSize; i++) {
        sumOfSquares += buffer[i] * buffer[i];
      }
      const bufferrms = Math.sqrt(sumOfSquares / bufferSize);

      this.port.postMessage({
        pitch: null,
        clarity: 0,
        bufferrms: bufferrms
      });
    }
  }
}

// Register logic
registerProcessor('pitch-processor', PitchProcessor);
export default PitchProcessor;
