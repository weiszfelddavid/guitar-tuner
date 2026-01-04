interface AudioWorkletNodeOptions {
  processorOptions?: {
    bufferSize?: number;
    threshold?: number;
  };
}

class PitchProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private bufferIndex: number = 0;
  private framesSinceLastDetect: number = 0;
  private threshold: number = 0.8;
  private readonly BUFFER_SIZE = 4096;
  private readonly PROCESSING_INTERVAL = 256;

  constructor(options?: AudioWorkletNodeOptions) {
    super();
    // Use fixed 4096 buffer for better bass resolution (approx 85ms window at 48kHz)
    this.buffer = new Float32Array(this.BUFFER_SIZE);
    this.threshold = options?.processorOptions?.threshold || 0.85;
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || !input.length) return true;
    
    const channel = input[0];
    
    // Fill Ring Buffer
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferIndex] = channel[i];
      this.bufferIndex = (this.bufferIndex + 1) % this.BUFFER_SIZE;
      
      this.framesSinceLastDetect++;
      
      // Run detection every PROCESSING_INTERVAL samples (overlap processing)
      if (this.framesSinceLastDetect >= this.PROCESSING_INTERVAL) {
        this.framesSinceLastDetect = 0;
        this.detectPitch();
      }
    }
    return true;
  }

  private detectPitch() {
    // 1. Unroll Ring Buffer to a temporary contiguous buffer
    const unrolledBuffer = new Float32Array(this.BUFFER_SIZE);
    const part1Length = this.BUFFER_SIZE - this.bufferIndex;
    unrolledBuffer.set(this.buffer.subarray(this.bufferIndex), 0);
    unrolledBuffer.set(this.buffer.subarray(0, this.bufferIndex), part1Length);


    // 2. Downsample (2x) the unrolled buffer
    const downsampledSize = this.BUFFER_SIZE / 2;
    const downsampledBuffer = new Float32Array(downsampledSize);
        
    let sumOfSquares = 0;
    
    for (let i = 0; i < downsampledSize; i++) {
      const s1 = unrolledBuffer[i * 2];
      const s2 = unrolledBuffer[i * 2 + 1];
      downsampledBuffer[i] = (s1 + s2) / 2;
      sumOfSquares += s1 * s1 + s2 * s2;
    }
    
    const bufferrms = Math.sqrt(sumOfSquares / this.BUFFER_SIZE);

    // --- YIN Algorithm on Downsampled Buffer ---
    const bufferSize = downsampledSize;
    const yinBuffer = new Float32Array(bufferSize / 2);
    
    for (let tau = 0; tau < bufferSize / 2; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < bufferSize / 2; i++) {
        const delta = downsampledBuffer[i] - downsampledBuffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < bufferSize / 2; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

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

    if (tauEstimate !== -1) {
      let betterTau = tauEstimate;
      if (tauEstimate > 0 && tauEstimate < (bufferSize / 2) - 1) {
        const s0 = yinBuffer[tauEstimate - 1];
        const s1 = yinBuffer[tauEstimate];
        const s2 = yinBuffer[tauEstimate + 1];
        let adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        adjustment = Math.min(Math.max(adjustment, -0.5), 0.5);
        betterTau += adjustment;
      }

      const effectiveSampleRate = sampleRate / 2;
      const pitch = effectiveSampleRate / betterTau;
      
      this.port.postMessage({
        pitch: pitch,
        clarity: 1 - yinBuffer[tauEstimate],
        bufferrms: bufferrms,
      });
    } else {
      this.port.postMessage({
        pitch: null,
        clarity: 0,
        bufferrms: bufferrms,
      });
    }
  }
}

registerProcessor('pitch-processor', PitchProcessor);
export default PitchProcessor;