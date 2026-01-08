// src/ui/tuner.ts

// Standard E Guitar Tuning Frequencies
const GUITAR_STRINGS = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110.00 },
  { name: 'D3', freq: 146.83 },
  { name: 'G3', freq: 196.00 }, 
  { name: 'B3', freq: 246.94 },
  { name: 'E4', freq: 329.63 }
];

export interface TunerState {
  noteName: string;
  cents: number;
  clarity: number;
  volume: number;
  isLocked: boolean;
}

export class KalmanFilter {
  private x: number = 0; // State estimate
  private p: number = 1; // Estimation error covariance
  private q: number;     // Process noise covariance
  private r: number;     // Measurement noise covariance
  private k: number = 0; // Kalman gain

  constructor(processNoise: number = 0.1, measurementNoise: number = 0.1) {
    this.q = processNoise;
    this.r = measurementNoise;
  }

  filter(measurement: number): number {
    // Prediction Update
    // x = x (no control input)
    this.p = this.p + this.q;

    // Measurement Update
    this.k = this.p / (this.p + this.r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;

    return this.x;
  }
  
  reset(value: number) {
      this.x = value;
      this.p = 1;
  }
}

export function getTunerState(pitch: number, clarity: number, volume: number): TunerState {
  // Thresholds:
  // Clarity < 0.9 means uncertain pitch.
  // Volume < 0.01 means silence/noise floor.
  if (clarity < 0.9 || volume < 0.01 || pitch < 60 || pitch > 500) {
    return { noteName: '--', cents: 0, clarity, volume, isLocked: false };
  }

  // Find closest string
  let closestString = GUITAR_STRINGS[0];
  let minDiff = Math.abs(pitch - closestString.freq);

  for (const str of GUITAR_STRINGS) {
    const diff = Math.abs(pitch - str.freq);
    if (diff < minDiff) {
      minDiff = diff;
      closestString = str;
    }
  }

  // Calculate cents
  // cents = 1200 * log2(f / f_target)
  const cents = 1200 * Math.log2(pitch / closestString.freq);

  return {
    noteName: closestString.name.replace(/\d/, ''), // Remove octave number for display
    cents: cents,
    clarity: clarity,
    volume: volume,
    isLocked: clarity > 0.95 && Math.abs(cents) < 2
  };
}

export class PluckDetector {
  private isAttacking: boolean = false;
  private attackEndTime: number = 0;
  private lastRms: number = 0;
  private readonly dbThreshold: number = 15; // dB increase to trigger attack
  private readonly timeWindow: number = 20;  // ms window for rise
  private readonly attackDuration: number = 200; // ms to damp pitch
  
  // Convert linear amplitude to dB
  private toDb(amp: number): number {
    return 20 * Math.log10(Math.max(amp, 0.0001));
  }

  process(currentRms: number, now: number): { isAttacking: boolean; factor: number } {
    const currentDb = this.toDb(currentRms);
    const lastDb = this.toDb(this.lastRms);
    const diff = currentDb - lastDb;

    // Detect sharp rise
    // Note: We are comparing frame-to-frame. 
    // Assuming approx 60fps or audio callback rate, a 15dB jump is HUGE.
    if (diff > this.dbThreshold && !this.isAttacking) {
      this.isAttacking = true;
      this.attackEndTime = now + this.attackDuration;
    }

    if (this.isAttacking) {
      if (now > this.attackEndTime) {
        this.isAttacking = false;
      }
    }

    this.lastRms = currentRms;

    return { 
      isAttacking: this.isAttacking,
      factor: this.isAttacking ? 0.1 : 1.0 // 0.1 weight during attack (heavy damping)
    };
  }
}

export class PitchStabilizer {
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

    // 1. Find Median
    const sorted = [...this.buffer].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // 2. Filter Outliers (>50 cents away approx)
    // Note: Frequency diff depends on pitch. 50 cents is approx 3% frequency change.
    // Ratio for 50 cents = 2^(50/1200) ≈ 1.029
    const validSamples = this.buffer.filter(p => {
        const ratio = p / median;
        return ratio > 0.97 && ratio < 1.03; 
    });

    // 3. Weighted Average (Bias towards most recent?)
    // For now, simple average of valid samples to be smooth.
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

    // Detected string is different
    if (detectedString === this.lastCandidate) {
      this.hysteresisCounter++;
    } else {
      this.lastCandidate = detectedString;
      this.hysteresisCounter = 1;
    }

    // If consistent for threshold, switch
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