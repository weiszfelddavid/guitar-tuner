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
}

export function getTunerState(pitch: number, clarity: number, volume: number): TunerState {
  if (clarity < 0.9 || volume < 0.01 || pitch < 60 || pitch > 500) {
    return { noteName: '--', cents: 0, clarity, volume, isLocked: false };
  }

  let closestString = GUITAR_STRINGS[0];
  let minDiff = Math.abs(pitch - closestString.freq);

  for (const str of GUITAR_STRINGS) {
    const diff = Math.abs(pitch - str.freq);
    if (diff < minDiff) {
      minDiff = diff;
      closestString = str;
    }
  }

  const cents = 1200 * Math.log2(pitch / closestString.freq);

  return {
    noteName: closestString.name.replace(/\d/, ''),
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

        const isString = (p: number) => GUITAR_STRINGS.some(s => Math.abs(1200 * Math.log2(p / s.freq)) < 100);

        if (isString(fundamental)) {
            if (this.lastNote === GUITAR_STRINGS.find(s => Math.abs(1200 * Math.log2(fundamental / s.freq)) < 100)?.name.replace(/\d/, '')) {
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

export class NoiseGate {
    private noiseFloor: number = 0.0001; 
    private readonly alpha: number = 0.1; 
    private readonly gateThresholdDb: number = 6;

    process(volume: number, clarity: number): boolean {
        const currentDb = 20 * Math.log10(Math.max(volume, 0.00001));
        const floorDb = 20 * Math.log10(Math.max(this.noiseFloor, 0.00001));

        if (clarity < 0.8) {
            // Adapt to noise floor. If current volume is higher than floor, 
            // update floor quickly to follow noise ramps.
            if (volume > this.noiseFloor) {
                this.noiseFloor = (1 - 0.5) * this.noiseFloor + 0.5 * volume;
            } else {
                this.noiseFloor = (1 - this.alpha) * this.noiseFloor + this.alpha * volume;
            }
        } else {
            // Slow decay when clarity is high
            this.noiseFloor *= 0.999;
        }

        return currentDb > (floorDb + this.gateThresholdDb);
    }
    
    getThreshold(): number {
        return this.noiseFloor * Math.pow(10, this.gateThresholdDb / 20);
    }
}