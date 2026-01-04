import { describe, it, expect, vi } from 'vitest';

// Define types for our mocks
interface MockPort {
  postMessage: ReturnType<typeof vi.fn>;
}

interface MockProcessor {
  port: MockPort;
}

describe('PitchProcessor', () => {
  it('should correctly detect 440Hz when audio is processed in chunks', async () => {
    // 1. DEFINE BROWSER GLOBALS
    const MockAudioWorkletProcessor = class {
      port: MockPort;
      constructor() {
        this.port = { postMessage: vi.fn() };
      }
    };
    vi.stubGlobal('AudioWorkletProcessor', MockAudioWorkletProcessor);
    vi.stubGlobal('registerProcessor', vi.fn());
    vi.stubGlobal('sampleRate', 48000); // More realistic sample rate

    // 2. LOAD THE FILE DYNAMICALLY
    const module = await import('./processor');
    const PitchProcessor = module.default;

    // 3. GENERATE SOUND (440Hz Sine Wave)
    const SAMPLE_RATE = 48000;
    const BUFFER_SIZE = 4096; // Internal buffer size of the processor
    const CHUNK_SIZE = 128;   // Realistic chunk size from the browser
    const sineWave = new Float32Array(BUFFER_SIZE);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      sineWave[i] = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE);
    }

    // 4. RUN THE ENGINE
    const processor = new PitchProcessor();
    const mockProcessor = processor as unknown as MockProcessor;
    const postMessage = vi.fn();
    mockProcessor.port = { postMessage };

    // Process the audio buffer in chunks
    for (let i = 0; i < BUFFER_SIZE; i += CHUNK_SIZE) {
      const chunk = sineWave.subarray(i, i + CHUNK_SIZE);
      processor.process([[chunk]], [], {});
    }

    // 5. VERIFY
    expect(postMessage).toHaveBeenCalled();
    
    // The pitch detection runs every 256 frames. 
    // The last few calls should have a stable pitch.
    const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1];
    const result = lastCall[0];
    
    // Add debug logging to see the test output
    console.log('Detected Pitch:', result.pitch);
    console.log('Detected Clarity:', result.clarity);

    expect(result.pitch).toBeGreaterThan(435);
    expect(result.pitch).toBeLessThan(445);
    expect(result.clarity).toBeGreaterThanOrEqual(0.9); // Expect high clarity for a pure sine wave
  });
});