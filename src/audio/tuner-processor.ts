// @ts-ignore
import init, { PitchDetector } from './pure_tone_lib.mjs';

// @ts-ignore
class TunerProcessor extends AudioWorkletProcessor {
  private detector: any = null; 
  private buffer: Float32Array;
  private samplesProcessed: number = 0;
  private readonly BUFFER_SIZE = 4096;
  private readonly UPDATE_INTERVAL = 800;
  private initialized = false;

  constructor() {
    super();
    this.buffer = new Float32Array(this.BUFFER_SIZE);
    
    // this.port.postMessage({ type: 'log', message: '[Worklet] Constructor called' });
    // @ts-ignore
    this.port.onmessage = this.handleMessage.bind(this);
  }

  async handleMessage(event: MessageEvent) {
    if (event.data.type === 'load-wasm') {
        // @ts-ignore
        this.port.postMessage({ type: 'log', message: '[Worklet] Received WASM bytes' });
        await this.initWasm(event.data.wasmBytes);
    }
  }

  async initWasm(wasmBytes: ArrayBuffer) {
    try {
      // this.port.postMessage({ type: 'log', message: '[Worklet] initWasm started with buffer' });
      
      await init(wasmBytes);
      // @ts-ignore
      this.detector = new PitchDetector(sampleRate, this.BUFFER_SIZE);
      this.initialized = true;
      // @ts-ignore
      this.port.postMessage({ type: 'log', message: '[Worklet] WASM initialized successfully' });
    } catch (e) {
      // @ts-ignore
      this.port.postMessage({ type: 'log', message: `[Worklet] Failed to initialize WASM: ${e}` });
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    /*
    if (this.samplesProcessed === 0 && Math.random() < 0.05) { 
         this.port.postMessage({ type: 'log', message: `[Worklet] process() loop active. Input channels: ${inputs[0]?.length}` });
    }
    */

    if (!this.initialized || !this.detector) return true;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    const inputLength = channelData.length;

    // Sliding Window Logic
    this.buffer.copyWithin(0, inputLength);
    
    if (inputLength >= this.BUFFER_SIZE) {
        this.buffer.set(channelData.subarray(inputLength - this.BUFFER_SIZE));
    } else {
        this.buffer.set(channelData, this.BUFFER_SIZE - inputLength);
    }

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

    try {
        const result = this.detector.process(this.buffer);
        // Post result to main thread
        // @ts-ignore
        this.port.postMessage({
            type: 'result',
            pitch: result.pitch,
            clarity: result.clarity,
            volume: rms
        });
    } catch (e) {
        // @ts-ignore
         this.port.postMessage({ type: 'log', message: `[Worklet] Error in processBuffer: ${e}` });
    }
  }
}

// @ts-ignore
registerProcessor('tuner-processor', TunerProcessor);
