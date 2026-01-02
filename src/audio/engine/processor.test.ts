import { describe, it, expect, vi } from 'vitest';

// Define types for our mocks
interface MockPort {
  postMessage: ReturnType<typeof vi.fn>;
}

interface MockProcessor {
  port: MockPort;
}

describe('PitchProcessor', () => {
  it('should correctly detect 440Hz', async () => {
    // 1. DEFINE BROWSER GLOBALS (Before loading the file)
    const MockAudioWorkletProcessor = class {
      port: MockPort;
      constructor() {
        this.port = { postMessage: vi.fn() };
      }
    };

    vi.stubGlobal('AudioWorkletProcessor', MockAudioWorkletProcessor);
    vi.stubGlobal('registerProcessor', vi.fn());

    // 2. LOAD THE FILE DYNAMICALLY (Wait for globals to be ready)
    // This prevents the "ReferenceError" crash
    const module = await import('./processor');
    const PitchProcessor = module.default;

    // 3. GENERATE SOUND (440Hz Sine Wave)
    const SAMPLE_RATE = 44100;
    const BUFFER_SIZE = 2048;
    const buffer = new Float32Array(BUFFER_SIZE);
    for (let i = 0; i < BUFFER_SIZE; i++) {
        buffer[i] = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE);
    }

    // 4. RUN THE ENGINE
    const processor = new PitchProcessor({
        processorOptions: { bufferSize: BUFFER_SIZE }
    });
    
    // Type cast to access the mocked port
    const mockProcessor = processor as unknown as MockProcessor;
    const postMessage = vi.fn();
    mockProcessor.port = { postMessage };

    // Process the audio buffer
    processor.process([[buffer]], [], {});

    // 5. VERIFY
    expect(postMessage).toHaveBeenCalled();
    const result = postMessage.mock.calls[0][0];
    
    console.log('Detected Pitch:', result.pitch);
    expect(result.pitch).toBeGreaterThan(435);
    expect(result.pitch).toBeLessThan(445);
  });
});