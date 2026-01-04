import { YIN } from 'pitchfinder';

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
  private readonly BUFFER_SIZE = 4096;
  private readonly PROCESSING_INTERVAL = 256;
  private detectPitchFn: (signal: Float32Array) => number | null;

  constructor(options?: AudioWorkletNodeOptions) {
    super();
    // Use fixed 4096 buffer for better bass resolution (approx 85ms window at 48kHz)
    this.buffer = new Float32Array(this.BUFFER_SIZE);
    
    // Initialize Pitchfinder YIN detector
    // We will be passing the downsampled buffer (approx 24kHz)
    // sampleRate is a global in AudioWorkletScope
    const effectiveSampleRate = sampleRate / 2;
    this.detectPitchFn = YIN({ 
      sampleRate: effectiveSampleRate,
      threshold: options?.processorOptions?.threshold || 0.15 // Pitchfinder default is usually good
    });
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
        this.performDetection();
      }
    }
    return true;
  }

  private performDetection() {
    // 1. Unroll Ring Buffer to a temporary contiguous buffer
    const unrolledBuffer = new Float32Array(this.BUFFER_SIZE);
    const part1Length = this.BUFFER_SIZE - this.bufferIndex;
    unrolledBuffer.set(this.buffer.subarray(this.bufferIndex), 0);
    unrolledBuffer.set(this.buffer.subarray(0, this.bufferIndex), part1Length);

    // 2. Downsample (2x) the unrolled buffer
    // We keep downsampling to save CPU and because guitar frequencies are low.
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

    // 3. Use Pitchfinder
    const pitch = this.detectPitchFn(downsampledBuffer);

    // Pitchfinder doesn't return clarity/probability directly in YIN.
    // We assume if it returned a pitch, it met the threshold.
    // We synthesize a high clarity for valid pitches to pass the UI gate.
    const clarity = pitch ? 0.9 : 0;

    this.port.postMessage({
      pitch: pitch || null,
      clarity: clarity,
      bufferrms: bufferrms,
    });
  }
}

registerProcessor('pitch-processor', PitchProcessor);
export default PitchProcessor;