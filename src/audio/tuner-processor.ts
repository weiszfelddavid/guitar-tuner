// import init, { PitchDetector } from '../../pkg/pure_tone.js';
// We use dynamic import inside initWasm to avoid top-level module loading issues in AudioWorklet

class TunerProcessor extends AudioWorkletProcessor {
  private detector: any = null; // Type as any since we load dynamically
  private buffer: Float32Array;
  private samplesProcessed: number = 0;
  private readonly BUFFER_SIZE = 4096; // Window size for YIN
  private readonly UPDATE_INTERVAL = 800; // ~16.6ms at 48kHz (Target 60Hz update)
  private initialized = false;

  constructor() {
    super();
    this.buffer = new Float32Array(this.BUFFER_SIZE);
    
    // Initialize WASM
    this.initWasm();
  }

  async initWasm() {
    try {
      // Dynamic import to decouple processor registration from WASM loading
      // @ts-ignore
      const module = await import('../../pkg/pure_tone.js');
      const init = module.default;
      const PitchDetector = module.PitchDetector;

      await init();
      // Sample rate is global in AudioWorkletGlobalScope
      this.detector = new PitchDetector(sampleRate, this.BUFFER_SIZE);
      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize WASM in worklet', e);
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.initialized || !this.detector) return true;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    const inputLength = channelData.length;

    // Sliding Window Logic
    // 1. Shift the existing buffer to the left by the amount of new data
    //    (Optimization: We could use a circular buffer, but copyWithin is fast for 4k elements)
    this.buffer.copyWithin(0, inputLength);
    
    // 2. Append new data to the end
    //    (Handle case where input is larger than buffer - rare but safe to just take last chunk)
    if (inputLength >= this.BUFFER_SIZE) {
        this.buffer.set(channelData.subarray(inputLength - this.BUFFER_SIZE));
    } else {
        this.buffer.set(channelData, this.BUFFER_SIZE - inputLength);
    }

    // 3. Check if it's time to process (Throttling to ~60Hz)
    this.samplesProcessed += inputLength;
    
    if (this.samplesProcessed >= this.UPDATE_INTERVAL) {
        this.processBuffer();
        this.samplesProcessed = 0;
    }

    return true;
  }

  processBuffer() {
    if (!this.detector) return;
    
    // Calculate RMS Volume for visual feedback
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) {
        sum += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sum / this.buffer.length);

    const result = this.detector.process(this.buffer);
    
    // Post result to main thread
    this.port.postMessage({
      pitch: result.pitch,
      clarity: result.clarity,
      volume: rms
    });
  }
}

registerProcessor('tuner-processor', TunerProcessor);
