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
// CONSOLIDATED PROCESSING CLASSES
// ============================================================================

/**
 * SignalProcessor - Validates and stabilizes incoming audio signal
 * Combines: NoiseGate + PitchStabilizer
 */
class SignalProcessor {
  // Noise gate state
  private noiseFloor: number = 0.0001;
  private readonly alpha: number = 0.1;
  private readonly gateThresholdDb: number = 6;

  // Pitch stabilizer state
  private pitchBuffer: number[] = [];
  private readonly bufferSize: number = 11;

  /**
   * Process incoming pitch/volume signal
   * @returns null if signal is invalid, stable pitch if valid
   */
  process(pitch: number, clarity: number, volume: number): number | null {
    // 1. Noise Gate - validate signal quality
    const currentDb = 20 * Math.log10(Math.max(volume, 0.00001));
    const floorDb = 20 * Math.log10(Math.max(this.noiseFloor, 0.00001));

    // Adaptive noise floor
    if (clarity < 0.8) {
      if (volume > this.noiseFloor) {
        this.noiseFloor = (1 - 0.05) * this.noiseFloor + 0.05 * volume;
      } else {
        this.noiseFloor = (1 - this.alpha) * this.noiseFloor + this.alpha * volume;
      }
    } else {
      this.noiseFloor *= 0.95;
    }

    const isGateOpen = currentDb > (floorDb + this.gateThresholdDb);
    if (!isGateOpen) {
      this.pitchBuffer = [];
      return null;
    }

    // 2. Pitch Stabilizer - only accept high-clarity pitches
    if (clarity > 0.9) {
      this.pitchBuffer.push(pitch);
      if (this.pitchBuffer.length > this.bufferSize) {
        this.pitchBuffer.shift();
      }
    } else {
      this.pitchBuffer = [];
    }

    if (this.pitchBuffer.length === 0) return null;
    if (this.pitchBuffer.length < 3) return this.pitchBuffer[this.pitchBuffer.length - 1];

    // Calculate stable pitch using median filtering
    const sorted = [...this.pitchBuffer].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const validSamples = this.pitchBuffer.filter(p => {
      const ratio = p / median;
      return ratio > 0.97 && ratio < 1.03;
    });

    if (validSamples.length === 0) return null;

    const sum = validSamples.reduce((a, b) => a + b, 0);
    return sum / validSamples.length;
  }

  reset() {
    this.pitchBuffer = [];
  }
}

/**
 * NoteDetector - Detects note from pitch with octave correction and hysteresis
 * Combines: OctaveDiscriminator + getTunerState + StringLocker
 */
class NoteDetector {
  // Octave discriminator state
  private lastDetectedNote: string | null = null;

  // String locker state
  private lockedString: string | null = null;
  private candidateString: string | null = null;
  private lockCounter: number = 0;
  private readonly lockThreshold: number = 15;

  /**
   * Detect note from pitch with octave correction and locking
   */
  detect(pitch: number, clarity: number, volume: number, config: TunerConfig): TunerState | null {
    // Invalid pitch range
    if (clarity < config.clarityThreshold || volume < 0.01 || pitch < 60 || pitch > 500) {
      this.reset();
      return null;
    }

    // Apply octave discrimination
    const correctedPitch = this.correctOctave(pitch, clarity);

    // Find closest string
    let closestString = GUITAR_STRINGS[0];
    let minDiff = Math.abs(correctedPitch - closestString.frequency);

    for (const str of GUITAR_STRINGS) {
      const diff = Math.abs(correctedPitch - str.frequency);
      if (diff < minDiff) {
        minDiff = diff;
        closestString = str;
      }
    }

    const cents = 1200 * Math.log2(correctedPitch / closestString.frequency);

    // Apply string locking (prevents jumping between strings)
    const finalNote = this.lockString(closestString.note);

    // Recalculate cents if note was locked
    const finalString = GUITAR_STRINGS.find(s => s.note === finalNote) || closestString;
    const finalCents = 1200 * Math.log2(correctedPitch / finalString.frequency);

    return {
      noteName: finalNote,
      cents: finalCents,
      clarity: clarity,
      volume: volume,
      isLocked: clarity > 0.95 && Math.abs(finalCents) < 2,
      frequency: correctedPitch
    };
  }

  /**
   * Correct octave errors (harmonics detected as fundamentals)
   */
  private correctOctave(pitch: number, clarity: number): number {
    const fundamental = pitch / 2;

    const isString = (p: number) => GUITAR_STRINGS.some(s => Math.abs(1200 * Math.log2(p / s.frequency)) < 100);

    if (isString(fundamental)) {
      // If we detected this fundamental last time, trust it
      if (this.lastDetectedNote === GUITAR_STRINGS.find(s => Math.abs(1200 * Math.log2(fundamental / s.frequency)) < 100)?.note) {
        return fundamental;
      }
      // If clarity is low, prefer fundamental (likely harmonic)
      if (clarity < 0.98) return fundamental;
    }

    return pitch;
  }

  /**
   * Apply hysteresis to prevent string jumping
   */
  private lockString(detectedString: string): string {
    // First detection
    if (!this.lockedString) {
      this.lockedString = detectedString;
      this.lastDetectedNote = detectedString;
      return detectedString;
    }

    // Same as locked string - reinforcement
    if (detectedString === this.lockedString) {
      this.lockCounter = 0;
      this.candidateString = null;
      this.lastDetectedNote = detectedString;
      return this.lockedString;
    }

    // Different string detected - count occurrences
    if (detectedString === this.candidateString) {
      this.lockCounter++;
    } else {
      this.candidateString = detectedString;
      this.lockCounter = 1;
    }

    // Threshold exceeded - switch to new string
    if (this.lockCounter > this.lockThreshold) {
      this.lockedString = detectedString;
      this.lockCounter = 0;
      this.candidateString = null;
    }

    this.lastDetectedNote = this.lockedString;
    return this.lockedString;
  }

  reset() {
    this.lockedString = null;
    this.candidateString = null;
    this.lockCounter = 0;
    this.lastDetectedNote = null;
  }
}

/**
 * StateManager - Manages transient detection and visual state hold
 * Combines: PluckDetector + VisualHoldManager
 */
class StateManager {
  // Pluck detection state
  private isAttacking: boolean = false;
  private attackEndTime: number = 0;
  private lastVolume: number = 0;
  private readonly attackDbThreshold: number = 15;
  private readonly attackDuration: number = 200;

  // Visual hold state
  private heldState: TunerState | null = null;
  private holdStartTime: number = 0;
  private readonly forgivingHoldDuration: number = 4000;
  private readonly strictHoldDuration: number = 400;

  /**
   * Manage state with attack detection and visual hold
   */
  process(
    currentState: TunerState | null,
    rawPitch: number,
    volume: number,
    mode: TunerMode,
    timestamp: number
  ): TunerState {
    // 1. Detect pluck attacks
    const attackInfo = this.detectAttack(volume, timestamp);

    // 2. Reset hold on new attack
    if (attackInfo.isAttacking) {
      this.heldState = null;
      this.holdStartTime = 0;
    }

    // 3. No valid state - check if we should hold previous state
    if (!currentState) {
      if (this.heldState && volume > 0.01) {
        const holdDuration = mode === 'forgiving' ? this.forgivingHoldDuration : this.strictHoldDuration;
        const timeSinceHold = timestamp - this.holdStartTime;

        if (timeSinceHold < holdDuration) {
          // Update cents if we have valid pitch (allows tuning during sustain)
          if (rawPitch > 60 && rawPitch < 500) {
            const targetString = GUITAR_STRINGS.find(s => s.note === this.heldState!.noteName);
            if (targetString) {
              const updatedCents = 1200 * Math.log2(rawPitch / targetString.frequency);
              return {
                ...this.heldState,
                cents: updatedCents,
                frequency: rawPitch,
                volume: volume
              };
            }
          }
          return this.heldState;
        }
      }

      // No hold - return empty state
      return { noteName: '--', cents: 0, clarity: 0, volume, isLocked: false, frequency: rawPitch };
    }

    // 4. Valid state - store for potential hold
    this.heldState = currentState;
    this.holdStartTime = timestamp;
    return currentState;
  }

  /**
   * Detect pluck attacks (sudden volume increase)
   */
  private detectAttack(volume: number, now: number): { isAttacking: boolean; factor: number } {
    const toDb = (amp: number) => 20 * Math.log10(Math.max(amp, 0.0001));

    const currentDb = toDb(volume);
    const lastDb = toDb(this.lastVolume);
    const diff = currentDb - lastDb;

    // Sudden volume increase = pluck
    if (diff > this.attackDbThreshold && !this.isAttacking) {
      this.isAttacking = true;
      this.attackEndTime = now + this.attackDuration;
    }

    // Attack window expired
    if (this.isAttacking && now > this.attackEndTime) {
      this.isAttacking = false;
    }

    this.lastVolume = volume;

    return {
      isAttacking: this.isAttacking,
      factor: this.isAttacking ? 0.1 : 1.0
    };
  }

  reset() {
    this.heldState = null;
    this.holdStartTime = 0;
    this.isAttacking = false;
    this.attackEndTime = 0;
    this.lastVolume = 0;
  }
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

  // Consolidated processing pipeline (3 classes instead of 6)
  private signalProcessor: SignalProcessor;
  private noteDetector: NoteDetector;
  private stateManager: StateManager;

  // Configuration
  private currentMode: TunerMode = 'strict';
  private config: TunerConfig;
  private manualStringLock: { note: string; frequency: number } | null = null;

  // Timing
  // @ts-ignore
  private startTime: number = currentTime * 1000;

  constructor() {
    super();
    this.buffer = new Float32Array(this.BUFFER_SIZE);

    // Initialize consolidated pipeline
    this.signalProcessor = new SignalProcessor();
    this.noteDetector = new NoteDetector();
    this.stateManager = new StateManager();

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

      // @ts-ignore
      const now = this.startTime + (currentTime * 1000);

      // Simplified 3-stage pipeline
      const finalState = this.runPipeline(pitch, clarity, volume, now);

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

  /**
   * Simplified 3-stage processing pipeline
   */
  private runPipeline(rawPitch: number, clarity: number, volume: number, now: number): TunerState {
    // Stage 1: Signal Processing - validate and stabilize
    const stablePitch = this.signalProcessor.process(rawPitch, clarity, volume);

    if (!stablePitch) {
      this.noteDetector.reset();
      return this.stateManager.process(null, rawPitch, volume, this.currentMode, now);
    }

    // Stage 2: Note Detection - detect note with octave correction and locking
    let detectedState = this.noteDetector.detect(stablePitch, clarity, volume, this.config);

    // Manual string lock override
    if (this.manualStringLock && detectedState) {
      detectedState = {
        ...detectedState,
        noteName: this.manualStringLock.note,
        cents: 1200 * Math.log2(stablePitch / this.manualStringLock.frequency)
      };
    }

    // Stage 3: State Management - handle transients and hold
    return this.stateManager.process(detectedState, stablePitch, volume, this.currentMode, now);
  }
}

// @ts-ignore
registerProcessor('tuner-processor', TunerProcessor);
