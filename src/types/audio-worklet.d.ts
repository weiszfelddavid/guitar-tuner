// Type declarations for AudioWorklet API
// These types are not included in standard TypeScript lib definitions

/**
 * AudioWorkletProcessor base class for audio processing in a separate thread
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
 */
declare class AudioWorkletProcessor {
  /**
   * Port for bidirectional communication with the main thread
   */
  readonly port: MessagePort;

  /**
   * Process audio samples
   * @param inputs - Array of input channels
   * @param outputs - Array of output channels
   * @param parameters - Audio parameters
   * @returns true to keep processor alive, false to destroy
   */
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

/**
 * Register an AudioWorkletProcessor class
 * @param name - Name to register the processor under
 * @param processorCtor - Constructor for the processor class
 */
declare function registerProcessor(
  name: string,
  processorCtor: typeof AudioWorkletProcessor
): void;

/**
 * Current time in the audio context (in seconds)
 * Available as a global in AudioWorkletGlobalScope
 */
declare const currentTime: number;

/**
 * Sample rate of the audio context
 * Available as a global in AudioWorkletGlobalScope
 */
declare const sampleRate: number;

/**
 * Current frame number (increments by 128 each render quantum)
 * Available as a global in AudioWorkletGlobalScope
 */
declare const currentFrame: number;
