// @ts-ignore
import init, { PitchDetector } from './pure_tone_lib.mjs';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type TunerMode = 'strict' | 'forgiving';

interface TunerConfig {
  mode: TunerMode;
  clarityThreshold: number;
  smoothingFactor: number;
}

interface TunerState {
  noteName: string;
  cents: number;
  clarity: number;
  volume: number;
  isLocked: boolean;
  frequency: number;
}

// Standard E Guitar Tuning Frequencies
// NOTE: Synchronized with src/constants/guitar-strings.ts
// Inlined here because worklet has separate bundling context
const GUITAR_STRINGS = [
  { note: 'E2', frequency: 82.41, stringNumber: 6, label: 'Low E' },
  { note: 'A2', frequency: 110.00, stringNumber: 5, label: 'A' },
  { note: 'D3', frequency: 146.83, stringNumber: 4, label: 'D' },
  { note: 'G3', frequency: 196.00, stringNumber: 3, label: 'G' },
  { note: 'B3', frequency: 246.94, stringNumber: 2, label: 'B' },
  { note: 'E4', frequency: 329.63, stringNumber: 1, label: 'High E' }
];

function getDefaultConfig(mode: TunerMode): TunerConfig {
  if (mode === 'strict') {
    return {
      mode: 'strict',
      clarityThreshold: 0.9,
      smoothingFactor: 0.1
    };
  } else {
    return {
      mode: 'forgiving',
      clarityThreshold: 0.6,
      smoothingFactor: 0.3
    };
  }
}

// ============================================================================
// PROCESSING CLASSES
// ============================================================================

class NoiseGate {
  private noiseFloor: number = 0.0001;
  private readonly alpha: number = 0.1;
  private readonly gateThresholdDb: number = 6;

  process(volume: number, clarity: number): boolean {
    const currentDb = 20 * Math.log10(Math.max(volume, 0.00001));
    const floorDb = 20 * Math.log10(Math.max(this.noiseFloor, 0.00001));

    if (clarity < 0.8) {
      if (volume > this.noiseFloor) {
        this.noiseFloor = (1 - 0.05) * this.noiseFloor + 0.05 * volume;
      } else {
        this.noiseFloor = (1 - this.alpha) * this.noiseFloor + this.alpha * volume;
      }
    } else {
      this.noiseFloor *= 0.95;
    }

    return currentDb > (floorDb + this.gateThresholdDb);
  }
}

class PitchStabilizer {
  private buffer: number[] = [];
  private readonly bufferSize: number = 11;

  add(pitch: number) {
    this.buffer.push(pitch);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
  }

  getStablePitch(): number {
    if (this.buffer.length === 0) return 0;
    if (this.buffer.length < 3) return this.buffer[this.buffer.length - 1];

    const sorted = [...this.buffer].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const validSamples = this.buffer.filter(p => {
      const ratio = p / median;
      return ratio > 0.97 && ratio < 1.03;
    });

    const sum = validSamples.reduce((a, b) => a + b, 0);
    return sum / validSamples.length;
  }

  clear() {
    this.buffer = [];
  }
}

class OctaveDiscriminator {
  private lastNote: string | null = null;

  process(pitch: number, clarity: number): number {
    const fundamental = pitch / 2;

    const isString = (p: number) => GUITAR_STRINGS.some(s => Math.abs(1200 * Math.log2(p / s.frequency)) < 100);

    if (isString(fundamental)) {
      if (this.lastNote === GUITAR_STRINGS.find(s => Math.abs(1200 * Math.log2(fundamental / s.frequency)) < 100)?.note) {
        return fundamental;
      }
      if (clarity < 0.98) return fundamental;
    }

    return pitch;
  }

  setLastNote(note: string | null) {
    this.lastNote = note;
  }
}

class StringLocker {
  private currentString: string | null = null;
  private lastCandidate: string | null = null;
  private hysteresisCounter: number = 0;
  private readonly hysteresisThreshold: number;

  constructor(thresholdFrames: number = 15) {
    this.hysteresisThreshold = thresholdFrames;
  }

  process(detectedString: string): string {
    if (!this.currentString) {
      this.currentString = detectedString;
      return detectedString;
    }

    if (detectedString === this.currentString) {
      this.hysteresisCounter = 0;
      this.lastCandidate = null;
      return this.currentString;
    }

    if (detectedString === this.lastCandidate) {
      this.hysteresisCounter++;
    } else {
      this.lastCandidate = detectedString;
      this.hysteresisCounter = 1;
    }

    if (this.hysteresisCounter > this.hysteresisThreshold) {
      this.currentString = detectedString;
      this.hysteresisCounter = 0;
      this.lastCandidate = null;
    }

    return this.currentString;
  }

  reset() {
    this.currentString = null;
    this.lastCandidate = null;
    this.hysteresisCounter = 0;
  }
}

class PluckDetector {
  private isAttacking: boolean = false;
  private attackEndTime: number = 0;
  private lastRms: number = 0;
  private readonly dbThreshold: number = 15;
  private readonly attackDuration: number = 200;

  private toDb(amp: number): number {
    return 20 * Math.log10(Math.max(amp, 0.0001));
  }

  process(currentRms: number, now: number): { isAttacking: boolean; factor: number } {
    const currentDb = this.toDb(currentRms);
    const lastDb = this.toDb(this.lastRms);
    const diff = currentDb - lastDb;

    if (diff > this.dbThreshold && !this.isAttacking) {
      this.isAttacking = true;
      this.attackEndTime = now + this.attackDuration;
    }

    if (this.isAttacking && now > this.attackEndTime) {
      this.isAttacking = false;
    }

    this.lastRms = currentRms;

    return {
      isAttacking: this.isAttacking,
      factor: this.isAttacking ? 0.1 : 1.0
    };
  }
}

class VisualHoldManager {
  private lastValidState: TunerState | null = null;
  private lastValidTime: number = 0;
  private readonly forgivingHoldDuration: number = 4000;
  private readonly strictHoldDuration: number = 400;

  process(currentState: TunerState, volume: number, mode: TunerMode, timestamp: number, isAttacking: boolean, rawPitch: number): TunerState {
    const holdDuration = mode === 'forgiving' ? this.forgivingHoldDuration : this.strictHoldDuration;

    if (isAttacking) {
      this.lastValidState = null;
      this.lastValidTime = 0;
    }

    if (currentState.noteName !== '--') {
      this.lastValidState = currentState;
      this.lastValidTime = timestamp;
      return currentState;
    }

    if (this.lastValidState && volume > 0.01) {
      const timeSinceLast = timestamp - this.lastValidTime;

      if (timeSinceLast < holdDuration) {
        if (rawPitch > 60 && rawPitch < 500) {
          const targetString = GUITAR_STRINGS.find(s =>
            s.note === this.lastValidState!.noteName
          );

          if (targetString) {
            const updatedCents = 1200 * Math.log2(rawPitch / targetString.frequency);

            return {
              ...this.lastValidState,
              cents: updatedCents,
              frequency: rawPitch,
              volume: volume
            };
          }
        }

        return this.lastValidState;
      }
    }

    return currentState;
  }

  reset() {
    this.lastValidState = null;
    this.lastValidTime = 0;
  }
}

function getTunerState(pitch: number, clarity: number, volume: number, config: TunerConfig): TunerState {
  if (clarity < config.clarityThreshold || volume < 0.01 || pitch < 60 || pitch > 500) {
    return { noteName: '--', cents: 0, clarity, volume, isLocked: false, frequency: pitch };
  }

  let closestString = GUITAR_STRINGS[0];
  let minDiff = Math.abs(pitch - closestString.frequency);

  for (const str of GUITAR_STRINGS) {
    const diff = Math.abs(pitch - str.frequency);
    if (diff < minDiff) {
      minDiff = diff;
      closestString = str;
    }
  }

  const cents = 1200 * Math.log2(pitch / closestString.frequency);

  return {
    noteName: closestString.note,
    cents: cents,
    clarity: clarity,
    volume: volume,
    isLocked: clarity > 0.95 && Math.abs(cents) < 2,
    frequency: pitch
  };
}

// ============================================================================
// WORKLET PROCESSOR
// ============================================================================

// @ts-ignore
class TunerProcessor extends AudioWorkletProcessor {
  private detector: any = null;
  private buffer: Float32Array;
  private samplesProcessed: number = 0;
  private readonly BUFFER_SIZE = 4096;
  private readonly UPDATE_INTERVAL = 800;
  private initialized = false;

  // Processing pipeline
  private noiseGate: NoiseGate;
  private pitchStabilizer: PitchStabilizer;
  private octaveDiscriminator: OctaveDiscriminator;
  private stringLocker: StringLocker;
  private pluckDetector: PluckDetector;
  private visualHoldManager: VisualHoldManager;

  // Configuration
  private currentMode: TunerMode = 'strict';
  private config: TunerConfig;
  private manualStringLock: { note: string; frequency: number } | null = null;

  // Timing for performance.now() equivalent
  // @ts-ignore
  private startTime: number = currentTime * 1000;

  constructor() {
    super();
    this.buffer = new Float32Array(this.BUFFER_SIZE);

    // Initialize processing pipeline
    this.noiseGate = new NoiseGate();
    this.pitchStabilizer = new PitchStabilizer();
    this.octaveDiscriminator = new OctaveDiscriminator();
    this.stringLocker = new StringLocker();
    this.pluckDetector = new PluckDetector();
    this.visualHoldManager = new VisualHoldManager();

    this.config = getDefaultConfig(this.currentMode);

    // @ts-ignore
    this.port.onmessage = this.handleMessage.bind(this);
  }

  async handleMessage(event: MessageEvent) {
    if (event.data.type === 'load-wasm') {
      // @ts-ignore
      this.port.postMessage({ type: 'log', message: '[Worklet] Received WASM bytes' });
      await this.initWasm(event.data.wasmBytes);
    } else if (event.data.type === 'set-mode') {
      this.currentMode = event.data.mode;
      this.config = getDefaultConfig(this.currentMode);
      // @ts-ignore
      this.port.postMessage({ type: 'log', message: `[Worklet] Mode changed to ${this.currentMode}` });
    } else if (event.data.type === 'set-string-lock') {
      this.manualStringLock = event.data.stringLock;
      // @ts-ignore
      this.port.postMessage({ type: 'log', message: `[Worklet] String lock: ${this.manualStringLock ? this.manualStringLock.note : 'none'}` });
    }
  }

  async initWasm(wasmBytes: ArrayBuffer) {
    try {
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

    // Calculate RMS Volume
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sum += this.buffer[i] * this.buffer[i];
    }
    const volume = Math.sqrt(sum / this.buffer.length);

    try {
      const result = this.detector.process(this.buffer);
      const { pitch, clarity } = result;

      // Get current time (worklet equivalent of performance.now())
      // @ts-ignore
      const now = this.startTime + (currentTime * 1000);

      // Run the full processing pipeline
      const finalState = this.runPipeline(pitch, clarity, volume, now);

      // Post final state to main thread
      // @ts-ignore
      this.port.postMessage({
        type: 'state',
        state: finalState
      });
    } catch (e) {
      // @ts-ignore
      this.port.postMessage({ type: 'log', message: `[Worklet] Error in processBuffer: ${e}` });
    }
  }

  private runPipeline(pitch: number, clarity: number, volume: number, now: number): TunerState {
    // 1. Noise Gate
    const isOpen = this.noiseGate.process(volume, clarity);

    if (!isOpen) {
      this.stringLocker.reset();
      return { noteName: '--', cents: 0, clarity, volume, isLocked: false, frequency: pitch };
    }

    // 2. Stabilize Pitch
    if (clarity > 0.9) {
      this.pitchStabilizer.add(pitch);
    } else {
      this.pitchStabilizer.clear();
    }

    const stablePitch = this.pitchStabilizer.getStablePitch();
    if (stablePitch === 0) {
      return { noteName: '--', cents: 0, clarity, volume, isLocked: false, frequency: pitch };
    }

    // 3. Octave Priority
    const prioritizedPitch = this.octaveDiscriminator.process(stablePitch, clarity);

    // 4. Pluck Detection
    const { isAttacking, factor } = this.pluckDetector.process(volume, now);

    // 5. State Calculation
    let rawState = getTunerState(prioritizedPitch, clarity, volume, this.config);

    // 6. Manual String Lock Override
    if (this.manualStringLock && rawState.noteName !== '--') {
      rawState.noteName = this.manualStringLock.note;
      rawState.cents = 1200 * Math.log2(prioritizedPitch / this.manualStringLock.frequency);
    }

    // 7. String Locking (only if not manually locked)
    if (rawState.noteName !== '--') {
      if (!this.manualStringLock) {
        rawState.noteName = this.stringLocker.process(rawState.noteName);
      }
      this.octaveDiscriminator.setLastNote(rawState.noteName);
    } else {
      this.stringLocker.reset();
      this.octaveDiscriminator.setLastNote(null);
    }

    // 8. Apply attack smoothing
    let processedState = rawState;
    if (isAttacking && rawState.noteName !== '--') {
      // Smooth cents during attack
      processedState = { ...rawState };
    }

    // 9. Visual Hold Manager
    const finalState = this.visualHoldManager.process(processedState, volume, this.currentMode, now, isAttacking, prioritizedPitch);

    return finalState;
  }
}

// @ts-ignore
registerProcessor('tuner-processor', TunerProcessor);
