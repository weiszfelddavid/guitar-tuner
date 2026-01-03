

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
  private threshold: number = 0.1;
  private readonly BUFFER_SIZE = 4096;
  private readonly PROCESSING_INTERVAL = 256;

  constructor(options?: AudioWorkletNodeOptions) {
    super();
    // Use fixed 4096 buffer for better bass resolution (approx 85ms window at 48kHz)
    this.buffer = new Float32Array(this.BUFFER_SIZE);
    this.threshold = options?.processorOptions?.threshold || 0.1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // 1. Unroll Ring Buffer & Downsample (2x)
    // We downsample 4096 samples -> 2048 samples.
    // This effectively gives us a sample rate of ~24kHz for detection.
    // Advantages: 
    // - Half the CPU load for YIN algorithm
    // - Filters out very high frequencies (>12kHz) automatically
    // - Keeps array sizes manageable (2048)
    const downsampledSize = this.BUFFER_SIZE / 2;
    const downsampledBuffer = new Float32Array(downsampledSize);
    
    // We want the *last* 4096 samples. 
    // Since bufferIndex points to the *next* write, the oldest sample is at bufferIndex.
    let readIndex = this.bufferIndex; 
    
    // Compute RMS of the full resolution signal for the noise gate
    let sumOfSquares = 0;
    
    for (let i = 0; i < downsampledSize; i++) {
      // Read two samples from the circular buffer
      const s1 = this.buffer[readIndex];
      readIndex = (readIndex + 1) % this.BUFFER_SIZE;
      const s2 = this.buffer[readIndex];
      readIndex = (readIndex + 1) % this.BUFFER_SIZE;

      // Simple averaging for downsampling
      downsampledBuffer[i] = (s1 + s2) / 2;
      
      // Accumulate RMS energy (from original samples)
      sumOfSquares += s1 * s1 + s2 * s2;
    }
    
    const bufferrms = Math.sqrt(sumOfSquares / this.BUFFER_SIZE);

    // --- YIN Algorithm on Downsampled Buffer ---
    const bufferSize = downsampledSize; // 2048
    const yinBuffer = new Float32Array(bufferSize / 2);
    
    // 1. Difference Function
    for (let tau = 0; tau < bufferSize / 2; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < bufferSize / 2; i++) {
        const delta = downsampledBuffer[i] - downsampledBuffer[i + tau];
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
      // Parabolic Interpolation
      let betterTau = tauEstimate;
      if (tauEstimate > 0 && tauEstimate < (bufferSize / 2) - 1) {
        const s0 = yinBuffer[tauEstimate - 1];
        const s1 = yinBuffer[tauEstimate];
        const s2 = yinBuffer[tauEstimate + 1];
        let adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        adjustment = Math.min(Math.max(adjustment, -0.5), 0.5);
        betterTau += adjustment;
      }

      // Calculate Pitch
      // IMPORTANT: We downsampled by 2, so the effective sample rate is halved.
      const effectiveSampleRate = sampleRate / 2;
      const pitch = effectiveSampleRate / betterTau;
      
      this.port.postMessage({
        pitch: pitch,
        clarity: 1 - yinBuffer[tauEstimate],
        bufferrms: bufferrms
      });
    } else {
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
