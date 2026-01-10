console.log('[tuner-processor] Module starting to load...');

import init, { PitchDetector } from './pure_tone_lib.mjs';

console.log('[tuner-processor] Imports successful');

import { findClosestString, calculateCents } from '../utils/frequency';

// Import constants (note: these are bundled separately for worklet context)
import {
  STRICT_MODE_CONFIG,
  FORGIVING_MODE_CONFIG,
  AUDIO_BUFFER_SIZE,
  PITCH_UPDATE_INTERVAL_SAMPLES,
  PITCH_STABILIZER_BUFFER_SIZE,
  PITCH_RATIO_TOLERANCE_MIN,
  PITCH_RATIO_TOLERANCE_MAX,
  PITCH_CLARITY_THRESHOLD,
  NOISE_GATE_THRESHOLD_DB,
  NOISE_GATE_ALPHA,
  NOISE_FLOOR_FAST_ADAPT_RATE,
  NOISE_FLOOR_SLOW_ADAPT_RATE,
  NOISE_FLOOR_DECAY_RATE,
  NOISE_DETECTION_CLARITY_THRESHOLD,
  ATTACK_DB_THRESHOLD,
  ATTACK_DURATION_MS,
  STRING_LOCK_HYSTERESIS_FRAMES,
  FORGIVING_HOLD_DURATION_MS,
  STRICT_HOLD_DURATION_MS,
  MIN_VALID_PITCH_HZ,
  MAX_VALID_PITCH_HZ,
  MIN_VOLUME_THRESHOLD,
  TUNED_CLARITY_THRESHOLD,
  TUNED_CENTS_THRESHOLD,
  OCTAVE_DISCRIMINATION_CLARITY,
  OCTAVE_CENTS_TOLERANCE
} from '../constants/tuner-config';

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
  isAttacking: boolean;
}

// Standard E Guitar Tuning Frequencies
// NOTE: Synchronized with src/constants/guitar-strings.ts
// Inlined here because worklet has separate bundling context
const GUITAR_STRINGS = [
  { note: 'E2', frequency: 82.41, stringNumber: 6, label: 'Low E', id: 'string-6' },
  { note: 'A2', frequency: 110.00, stringNumber: 5, label: 'A', id: 'string-5' },
  { note: 'D3', frequency: 146.83, stringNumber: 4, label: 'D', id: 'string-4' },
  { note: 'G3', frequency: 196.00, stringNumber: 3, label: 'G', id: 'string-3' },
  { note: 'B3', frequency: 246.94, stringNumber: 2, label: 'B', id: 'string-2' },
  { note: 'E4', frequency: 329.63, stringNumber: 1, label: 'High E', id: 'string-1' }
];

// Configuration constants (using imported config objects)
const STRICT_CONFIG: TunerConfig = {
  mode: 'strict',
  clarityThreshold: STRICT_MODE_CONFIG.clarityThreshold,
  smoothingFactor: STRICT_MODE_CONFIG.smoothingFactor
};

const FORGIVING_CONFIG: TunerConfig = {
  mode: 'forgiving',
  clarityThreshold: FORGIVING_MODE_CONFIG.clarityThreshold,
  smoothingFactor: FORGIVING_MODE_CONFIG.smoothingFactor
};

function getDefaultConfig(mode: TunerMode): TunerConfig {
  return mode === 'strict' ? STRICT_CONFIG : FORGIVING_CONFIG;
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
  private readonly alpha: number = NOISE_GATE_ALPHA;
  private readonly gateThresholdDb: number = NOISE_GATE_THRESHOLD_DB;

  // Pitch stabilizer state - using circular buffer for efficiency
  private readonly bufferSize: number = PITCH_STABILIZER_BUFFER_SIZE;
  private pitchBuffer: Float32Array = new Float32Array(this.bufferSize);
  private bufferCount: number = 0;
  private bufferIndex: number = 0;

  // Pre-allocated arrays to avoid GC pressure
  private sortedBuffer: Float32Array = new Float32Array(this.bufferSize);
  private validSamples: Float32Array = new Float32Array(this.bufferSize);
  private validCount: number = 0;

  /**
   * Process incoming pitch/volume signal
   * @returns null if signal is invalid, stable pitch if valid
   */
  process(pitch: number, clarity: number, volume: number): number | null {
    // 1. Noise Gate - validate signal quality
    const currentDb = 20 * Math.log10(Math.max(volume, 0.00001));
    const floorDb = 20 * Math.log10(Math.max(this.noiseFloor, 0.00001));

    // Adaptive noise floor
    if (clarity < NOISE_DETECTION_CLARITY_THRESHOLD) {
      if (volume > this.noiseFloor) {
        this.noiseFloor = (1 - NOISE_FLOOR_FAST_ADAPT_RATE) * this.noiseFloor + NOISE_FLOOR_FAST_ADAPT_RATE * volume;
      } else {
        this.noiseFloor = (1 - this.alpha) * this.noiseFloor + this.alpha * volume;
      }
    } else {
      this.noiseFloor *= NOISE_FLOOR_DECAY_RATE;
    }

    const isGateOpen = currentDb > (floorDb + this.gateThresholdDb);
    if (!isGateOpen) {
      this.bufferCount = 0;
      this.bufferIndex = 0;
      return null;
    }

    // 2. Pitch Stabilizer - only accept high-clarity pitches
    if (clarity > PITCH_CLARITY_THRESHOLD) {
      // Add to circular buffer
      this.pitchBuffer[this.bufferIndex] = pitch;
      this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
      if (this.bufferCount < this.bufferSize) {
        this.bufferCount++;
      }
    } else {
      this.bufferCount = 0;
      this.bufferIndex = 0;
    }

    if (this.bufferCount === 0) return null;
    if (this.bufferCount < 3) {
      // Return most recent sample
      const lastIdx = (this.bufferIndex - 1 + this.bufferSize) % this.bufferSize;
      return this.pitchBuffer[lastIdx];
    }

    // Calculate stable pitch using median filtering (optimized)
    // Copy current buffer values to sorted buffer
    for (let i = 0; i < this.bufferCount; i++) {
      this.sortedBuffer[i] = this.pitchBuffer[i];
    }

    // Sort only the valid portion
    this.quickSort(this.sortedBuffer, 0, this.bufferCount - 1);
    const median = this.sortedBuffer[Math.floor(this.bufferCount / 2)];

    // Filter samples within tolerance of median (reuse validSamples array)
    this.validCount = 0;
    for (let i = 0; i < this.bufferCount; i++) {
      const ratio = this.pitchBuffer[i] / median;
      if (ratio > PITCH_RATIO_TOLERANCE_MIN && ratio < PITCH_RATIO_TOLERANCE_MAX) {
        this.validSamples[this.validCount++] = this.pitchBuffer[i];
      }
    }

    if (this.validCount === 0) return null;

    // Average valid samples
    let sum = 0;
    for (let i = 0; i < this.validCount; i++) {
      sum += this.validSamples[i];
    }
    return sum / this.validCount;
  }

  /**
   * In-place quicksort for Float32Array (optimized for small arrays)
   */
  private quickSort(arr: Float32Array, left: number, right: number): void {
    if (left >= right) return;

    const pivot = arr[Math.floor((left + right) / 2)];
    let i = left;
    let j = right;

    while (i <= j) {
      while (arr[i] < pivot) i++;
      while (arr[j] > pivot) j--;

      if (i <= j) {
        // Swap
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
        i++;
        j--;
      }
    }

    if (left < j) this.quickSort(arr, left, j);
    if (i < right) this.quickSort(arr, i, right);
  }

  reset() {
    this.bufferCount = 0;
    this.bufferIndex = 0;
    this.validCount = 0;
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
  private readonly lockThreshold: number = STRING_LOCK_HYSTERESIS_FRAMES;

  /**
   * Detect note from pitch with octave correction and locking
   */
  detect(pitch: number, clarity: number, volume: number, config: TunerConfig): TunerState | null {
    // Invalid pitch range
    if (clarity < config.clarityThreshold || volume < MIN_VOLUME_THRESHOLD || pitch < MIN_VALID_PITCH_HZ || pitch > MAX_VALID_PITCH_HZ) {
      this.reset();
      return null;
    }

    // Apply octave discrimination
    const correctedPitch = this.correctOctave(pitch, clarity);

    // Find closest string
    const closestString = findClosestString(correctedPitch, GUITAR_STRINGS);
    const cents = calculateCents(correctedPitch, closestString.frequency);

    // Apply string locking (prevents jumping between strings)
    const finalNote = this.lockString(closestString.note);

    // Recalculate cents if note was locked
    const finalString = GUITAR_STRINGS.find(s => s.note === finalNote) || closestString;
    const finalCents = calculateCents(correctedPitch, finalString.frequency);

    return {
      noteName: finalNote,
      cents: finalCents,
      clarity: clarity,
      volume: volume,
      isLocked: clarity > TUNED_CLARITY_THRESHOLD && Math.abs(finalCents) < TUNED_CENTS_THRESHOLD,
      frequency: correctedPitch,
      isAttacking: false  // Will be set by StateManager
    };
  }

  /**
   * Correct octave errors (harmonics detected as fundamentals)
   */
  private correctOctave(pitch: number, clarity: number): number {
    const fundamental = pitch / 2;

    const isString = (p: number) => GUITAR_STRINGS.some(s => Math.abs(1200 * Math.log2(p / s.frequency)) < OCTAVE_CENTS_TOLERANCE);

    if (isString(fundamental)) {
      // If we detected this fundamental last time, trust it
      if (this.lastDetectedNote === GUITAR_STRINGS.find(s => Math.abs(1200 * Math.log2(fundamental / s.frequency)) < OCTAVE_CENTS_TOLERANCE)?.note) {
        return fundamental;
      }
      // If clarity is low, prefer fundamental (likely harmonic)
      if (clarity < OCTAVE_DISCRIMINATION_CLARITY) return fundamental;
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
  private readonly attackDbThreshold: number = ATTACK_DB_THRESHOLD;
  private readonly attackDuration: number = ATTACK_DURATION_MS;

  // Visual hold state
  private heldState: TunerState | null = null;
  private holdStartTime: number = 0;
  private readonly forgivingHoldDuration: number = FORGIVING_HOLD_DURATION_MS;
  private readonly strictHoldDuration: number = STRICT_HOLD_DURATION_MS;

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
    this.detectAttack(volume, timestamp);

    // 2. Reset hold on new attack
    if (this.isAttacking) {
      this.heldState = null;
      this.holdStartTime = 0;
    }

    // 3. No valid state - check if we should hold previous state
    if (!currentState) {
      if (this.heldState && volume > MIN_VOLUME_THRESHOLD) {
        const holdDuration = mode === 'forgiving' ? this.forgivingHoldDuration : this.strictHoldDuration;
        const timeSinceHold = timestamp - this.holdStartTime;

        if (timeSinceHold < holdDuration) {
          // Update cents if we have valid pitch (allows tuning during sustain)
          if (rawPitch > MIN_VALID_PITCH_HZ && rawPitch < MAX_VALID_PITCH_HZ) {
            const targetString = GUITAR_STRINGS.find(s => s.note === this.heldState!.noteName);
            if (targetString) {
              const updatedCents = calculateCents(rawPitch, targetString.frequency);
              return {
                ...this.heldState,
                cents: updatedCents,
                frequency: rawPitch,
                volume: volume,
                isAttacking: this.isAttacking
              };
            }
          }
          return { ...this.heldState, isAttacking: this.isAttacking };
        }
      }

      // No hold - return empty state
      return { noteName: '--', cents: 0, clarity: 0, volume, isLocked: false, frequency: rawPitch, isAttacking: this.isAttacking };
    }

    // 4. Valid state - store for potential hold
    this.heldState = currentState;
    this.holdStartTime = timestamp;
    return { ...currentState, isAttacking: this.isAttacking };
  }

  /**
   * Detect pluck attacks (sudden volume increase)
   */
  private detectAttack(volume: number, now: number): void {
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

class TunerProcessor extends AudioWorkletProcessor {
  private detector: PitchDetector | null = null;
  private buffer: Float32Array;
  private samplesProcessed: number = 0;
  private readonly BUFFER_SIZE = AUDIO_BUFFER_SIZE;
  private readonly UPDATE_INTERVAL = PITCH_UPDATE_INTERVAL_SAMPLES;
  private initialized = false;

  // Consolidated processing pipeline (3 classes instead of 6)
  private signalProcessor: SignalProcessor;
  private noteDetector: NoteDetector;
  private stateManager: StateManager;

  // Configuration
  private currentMode: TunerMode = 'strict';
  private config: TunerConfig;
  private manualStringLock: { note: string; frequency: number } | null = null;


  constructor() {
    super();
    this.buffer = new Float32Array(this.BUFFER_SIZE);

    // Initialize consolidated pipeline
    this.signalProcessor = new SignalProcessor();
    this.noteDetector = new NoteDetector();
    this.stateManager = new StateManager();

    this.config = getDefaultConfig(this.currentMode);

    this.port.onmessage = this.handleMessage.bind(this);

    // Send ready signal immediately after construction
    // This confirms that the processor was constructed successfully
    console.log('[tuner-processor] Constructor completed, sending initial ready signal');
    this.port.postMessage({ type: 'worklet-ready', initialized: this.initialized });
  }

  async handleMessage(event: MessageEvent) {
    if (event.data.type === 'check-ready') {
      // Respond to ready check from main thread
      console.log('[tuner-processor] Received check-ready, responding with worklet-ready');
      this.port.postMessage({ type: 'worklet-ready', initialized: this.initialized });
    } else if (event.data.type === 'load-wasm') {
      this.port.postMessage({ type: 'log', message: '[Worklet] Received WASM bytes' });
      await this.initWasm(event.data.wasmBytes);
    } else if (event.data.type === 'set-mode') {
      this.currentMode = event.data.mode;
      this.config = getDefaultConfig(this.currentMode);
      this.port.postMessage({ type: 'log', message: `[Worklet] Mode changed to ${this.currentMode}` });
    } else if (event.data.type === 'set-string-lock') {
      this.manualStringLock = event.data.stringLock;
      this.port.postMessage({ type: 'log', message: `[Worklet] String lock: ${this.manualStringLock ? this.manualStringLock.note : 'none'}` });
    }
  }

  async initWasm(wasmBytes: ArrayBuffer) {
    try {
      await init(wasmBytes);
      this.detector = new PitchDetector(sampleRate, this.BUFFER_SIZE);
      this.initialized = true;
      this.port.postMessage({ type: 'log', message: '[Worklet] WASM initialized successfully' });
    } catch (e) {
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

      // Use AudioWorkletGlobalScope's currentTime (in seconds), convert to ms
      const now = currentTime * 1000;

      // Simplified 3-stage pipeline
      const finalState = this.runPipeline(pitch, clarity, volume, now);

      this.port.postMessage({
        type: 'state',
        state: finalState
      });
    } catch (e) {
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

// Register processor immediately when module loads
try {
  console.log('[tuner-processor] About to call registerProcessor...');
  registerProcessor('tuner-processor', TunerProcessor);
  console.log('[tuner-processor] Successfully registered processor');
} catch (error) {
  console.error('[tuner-processor] Failed to register:', error);
  console.error('[tuner-processor] Error details:', error instanceof Error ? error.message : String(error));
  console.error('[tuner-processor] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
  throw error;
}
