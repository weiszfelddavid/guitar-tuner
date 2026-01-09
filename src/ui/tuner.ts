// src/ui/tuner.ts

import { GUITAR_STRINGS, getStringByNote } from '../constants/guitar-strings';
import {
  STRICT_MODE_CONFIG,
  FORGIVING_MODE_CONFIG,
  PITCH_STABILIZER_BUFFER_SIZE,
  PITCH_RATIO_TOLERANCE_MIN,
  PITCH_RATIO_TOLERANCE_MAX,
  NOISE_GATE_THRESHOLD_DB,
  NOISE_GATE_ALPHA,
  NOISE_FLOOR_FAST_ADAPT_RATE,
  NOISE_FLOOR_SLOW_ADAPT_RATE,
  NOISE_FLOOR_DECAY_RATE,
  NOISE_DETECTION_CLARITY_THRESHOLD,
  ATTACK_DB_THRESHOLD,
  ATTACK_DURATION_MS,
  ATTACK_FACTOR,
  SUSTAIN_FACTOR,
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
import { findClosestString, calculateCents } from '../utils/frequency';

// Helper function to get string info from note name
export function getStringInfo(noteName: string): { stringNumber: number; stringName: string } | null {
  const stringData = getStringByNote(noteName);
  if (stringData) {
    return { stringNumber: stringData.stringNumber, stringName: stringData.label };
  }
  return null;
}

export interface TunerState {
  noteName: string;
  cents: number;
  clarity: number;
  volume: number;
  isLocked: boolean;
  frequency: number; // Raw detected frequency in Hz
  isAttacking: boolean; // True during pluck attack transient
}

export type TunerMode = 'strict' | 'forgiving';

export interface TunerConfig {
  mode: TunerMode;
  clarityThreshold: number;
  smoothingFactor: number;
}

export class KalmanFilter {
  private x: number = 0;
  private p: number = 1;
  private q: number;
  private r: number;
  private k: number = 0;

  constructor(processNoise: number = 0.1, measurementNoise: number = 0.1) {
    this.q = processNoise;
    this.r = measurementNoise;
  }

  filter(measurement: number): number {
    this.p = this.p + this.q;
    this.k = this.p / (this.p + this.r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;
    return this.x;
  }

  reset(value: number) {
      this.x = value;
      this.p = 1;
  }

  setProcessNoise(processNoise: number) {
      this.q = processNoise;
  }

  setMeasurementNoise(measurementNoise: number) {
      this.r = measurementNoise;
  }
}

export function getDefaultConfig(mode: TunerMode): TunerConfig {
  return mode === 'strict' ? STRICT_MODE_CONFIG : FORGIVING_MODE_CONFIG;
}

export function getTunerState(pitch: number, clarity: number, volume: number, config?: TunerConfig): TunerState {
  const cfg = config || getDefaultConfig('strict');

  if (clarity < cfg.clarityThreshold || volume < MIN_VOLUME_THRESHOLD || pitch < MIN_VALID_PITCH_HZ || pitch > MAX_VALID_PITCH_HZ) {
    return { noteName: '--', cents: 0, clarity, volume, isLocked: false, frequency: pitch, isAttacking: false };
  }

  const closestString = findClosestString(pitch);
  const cents = calculateCents(pitch, closestString.frequency);

  return {
    noteName: closestString.note, // Keep full name with octave (e.g., E2, A2, D3)
    cents: cents,
    clarity: clarity,
    volume: volume,
    isLocked: clarity > TUNED_CLARITY_THRESHOLD && Math.abs(cents) < TUNED_CENTS_THRESHOLD,
    frequency: pitch,
    isAttacking: false
  };
}

export class PluckDetector {
  private isAttacking: boolean = false;
  private attackEndTime: number = 0;
  private lastRms: number = 0;
  private readonly dbThreshold: number = ATTACK_DB_THRESHOLD;
  private readonly attackDuration: number = ATTACK_DURATION_MS;

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
      factor: this.isAttacking ? ATTACK_FACTOR : SUSTAIN_FACTOR
    };
  }
}

export class PitchStabilizer {
  private buffer: number[] = [];
  private readonly bufferSize: number = PITCH_STABILIZER_BUFFER_SIZE;

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
        return ratio > PITCH_RATIO_TOLERANCE_MIN && ratio < PITCH_RATIO_TOLERANCE_MAX;
    });

    const sum = validSamples.reduce((a, b) => a + b, 0);
    return sum / validSamples.length;
  }
  
  clear() {
      this.buffer = [];
  }
}

export class StringLocker {
  private currentString: string | null = null;
  private lastCandidate: string | null = null;
  private hysteresisCounter: number = 0;
  private readonly hysteresisThreshold: number;

  constructor(thresholdFrames: number = STRING_LOCK_HYSTERESIS_FRAMES) {
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

export class OctaveDiscriminator {
    private lastNote: string | null = null;

    process(pitch: number, clarity: number): number {
        const fundamental = pitch / 2;
        const double = pitch * 2;

        const isString = (p: number) => GUITAR_STRINGS.some(s => Math.abs(1200 * Math.log2(p / s.frequency)) < OCTAVE_CENTS_TOLERANCE);

        if (isString(fundamental)) {
            if (this.lastNote === GUITAR_STRINGS.find(s => Math.abs(1200 * Math.log2(fundamental / s.frequency)) < OCTAVE_CENTS_TOLERANCE)?.note) {
                return fundamental;
            }
            if (clarity < OCTAVE_DISCRIMINATION_CLARITY) return fundamental;
        }

        return pitch;
    }
    
    setLastNote(note: string | null) {
        this.lastNote = note;
    }
}

export class NoiseGate {
    private noiseFloor: number = 0.0001;
    private readonly alpha: number = NOISE_GATE_ALPHA;
    private readonly gateThresholdDb: number = NOISE_GATE_THRESHOLD_DB;

    process(volume: number, clarity: number): boolean {
        const currentDb = 20 * Math.log10(Math.max(volume, 0.00001));
        const floorDb = 20 * Math.log10(Math.max(this.noiseFloor, 0.00001));

        if (clarity < NOISE_DETECTION_CLARITY_THRESHOLD) {
            // Adapt to noise floor. If current volume is higher than floor,
            // update floor quickly to follow noise ramps.
            if (volume > this.noiseFloor) {
                this.noiseFloor = (1 - NOISE_FLOOR_FAST_ADAPT_RATE) * this.noiseFloor + NOISE_FLOOR_FAST_ADAPT_RATE * volume;
            } else {
                this.noiseFloor = (1 - this.alpha) * this.noiseFloor + this.alpha * volume;
            }
        } else {
            // Slow decay when clarity is high
            this.noiseFloor *= NOISE_FLOOR_DECAY_RATE;
        }

        return currentDb > (floorDb + this.gateThresholdDb);
    }

    getThreshold(): number {
        return this.noiseFloor * Math.pow(10, this.gateThresholdDb / 20);
    }
}

export class VisualHoldManager {
    private lastValidState: TunerState | null = null;
    private lastValidTime: number = 0;
    private readonly forgivingHoldDuration: number = FORGIVING_HOLD_DURATION_MS;
    private readonly strictHoldDuration: number = STRICT_HOLD_DURATION_MS;

    process(currentState: TunerState, volume: number, mode: TunerMode, timestamp: number, isAttacking: boolean = false, rawPitch: number = 0): TunerState {
        // Determine hold duration based on mode
        const holdDuration = mode === 'forgiving' ? this.forgivingHoldDuration : this.strictHoldDuration;

        // Reset hold on new attack (fresh pluck)
        if (isAttacking) {
            this.lastValidState = null;
            this.lastValidTime = 0;
        }

        // If we have a valid note, store it
        if (currentState.noteName !== '--') {
            this.lastValidState = currentState;
            this.lastValidTime = timestamp;
            return currentState;
        }

        // If signal drops but we have recent valid state and volume is still present
        if (this.lastValidState && volume > MIN_VOLUME_THRESHOLD) {
            const timeSinceLast = timestamp - this.lastValidTime;

            // Hold the last valid note if within hold duration
            if (timeSinceLast < holdDuration) {
                // Continue updating cents/frequency if we have valid pitch data
                // This allows user to see pitch evolve while turning tuning peg
                if (rawPitch > MIN_VALID_PITCH_HZ && rawPitch < MAX_VALID_PITCH_HZ) {
                    // Find the target frequency for the held note
                    const targetString = GUITAR_STRINGS.find(s =>
                        s.note === this.lastValidState!.noteName
                    );

                    if (targetString) {
                        // Calculate cents relative to the held note's target frequency
                        const updatedCents = 1200 * Math.log2(rawPitch / targetString.frequency);

                        // Return held note with updated pitch tracking
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

        // Otherwise, return the current state (no note)
        return currentState;
    }

    reset() {
        this.lastValidState = null;
        this.lastValidTime = 0;
    }
}