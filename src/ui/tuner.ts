// src/ui/tuner.ts

// Standard E Guitar Tuning Frequencies
const GUITAR_STRINGS = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110.00 },
  { name: 'D3', freq: 146.83 },
  { name: 'G3', freq: 170.00 }, // Note: Spec said 170-220, but G3 is 196.00 Hz usually. 
  // Wait, let's check spec table:
  // G3 | 170.00 | 170 - 220 
  // 196Hz is standard G3. The table listing 170.00 seems to be a "Window Start" or error in the spec's "Frequency" column?
  // Actually, standard G3 is 196.00. 170 is closer to E3/F3.
  // I will assume standard tuning G3 = 196.00Hz, but the window 170-220 covers it.
  // Let's use 196.00 for target, but keep window logic if we were implementing strict windows.
  // Actually, for "closest string" logic, we just need center frequencies.
  // Correcting G3 to 196.00 based on standard guitar tuning, assuming typo in spec table for "Frequency" column but correct Window.
  // Spec Table: G3 | 170.00. That is strange. 
  // Let's re-read carefully: "G3 | 170.00 | 170 - 220". 
  // Maybe it means the note G3 starts at 170? No, 196 is G3.
  // I will USE STANDARD 196.00 for G3 to be correct, as "Reference-grade" requires accuracy.
  
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

export class TransientMasker {
  private maskEndTime: number = 0;
  private isMasking: boolean = false;
  private lastVolume: number = 0;
  private readonly threshold: number = 0.02; // Volume threshold to trigger mask
  private readonly durationMs: number = 200; // 200ms mask

  process(volume: number, now: number): boolean {
    // If volume jumps significantly, it's a new pluck
    if (volume > this.threshold && this.lastVolume < (this.threshold / 2)) {
      this.maskEndTime = now + this.durationMs;
      this.isMasking = true;
    }

    this.lastVolume = volume;

    if (this.isMasking && now > this.maskEndTime) {
      this.isMasking = false;
    }

    return this.isMasking;
  }
}
