import { describe, it, expect } from 'vitest';
import { PluckDetector, PitchStabilizer, StringLocker, getTunerState, OctaveDiscriminator, NoiseGate } from './tuner';
import fs from 'fs';
import path from 'path';

describe('PitchStabilizer', () => {
    it('should reject outliers using median filter', () => {
        const fixturePath = path.resolve(__dirname, '../../tests/fixtures/pitch_noisy.json');
        if (!fs.existsSync(fixturePath)) {
             console.warn('Skipping fixture test: file not found.');
             return;
        }
        
        const pitches = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
        const stabilizer = new PitchStabilizer();
        
        // Feed pitches
        let processed = [];
        for (const p of pitches) {
            stabilizer.add(p);
            processed.push(stabilizer.getStablePitch());
        }
        
        // The fixture has a spike at index 15 (110.00Hz)
        // The stabilizer should ignore it and output approx 82.41
        
        const spikeOutput = processed[15];
        expect(spikeOutput).toBeLessThan(85); // Should be near 82.41, NOT 110
        expect(spikeOutput).toBeGreaterThan(80);
    });
});

describe('PluckDetector', () => {
  it('should detect sharp volume rise', () => {
    const detector = new PluckDetector();
    const now = 1000;

    // Silence (-80dB)
    expect(detector.process(0.0001, now).isAttacking).toBe(false);

    // Sudden Loud Pluck (0.1 is -20dB) -> jump of 60dB!
    const result = detector.process(0.1, now);
    expect(result.isAttacking).toBe(true);
    expect(result.factor).toBe(0.1);
  });

  it('should release attack state after duration', () => {
    const detector = new PluckDetector();
    const now = 1000;

    // Trigger attack
    detector.process(0.0001, now);
    detector.process(0.1, now);
    
    // Fast forward 201ms
    const result = detector.process(0.09, now + 201);
    expect(result.isAttacking).toBe(false);
    expect(result.factor).toBe(1.0);
  });

  it('should correctly trigger on synthetic E2 pluck signal', () => {
    const fixturePath = path.resolve(__dirname, '../../tests/fixtures/pluck_E2.json');
    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping fixture test: file not found. Run "npx tsx scripts/generate_test_signals.ts" first.');
      return;
    }

    const buffer = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const detector = new PluckDetector();
    
    let attackTriggered = false;
    let attackFrame = 0;
    
    // Simulate processing loop at ~48kHz (processing every 128 samples is standard, 
    // but here we just need to pass volume. 
    // Let's assume we get a volume reading every ~10ms (480 samples).
    
    const stepSize = 480; 
    let currentTime = 0;
    
    for (let i = 0; i < buffer.length; i += stepSize) {
      // Calculate RMS for this chunk (simplified as peak abs for this test or just taking a sample)
      // The fixture is already amplitude.
      // Let's take the max amplitude in this window to simulate "Volume"
      let windowMax = 0;
      for (let j = 0; j < stepSize && (i + j) < buffer.length; j++) {
        windowMax = Math.max(windowMax, Math.abs(buffer[i+j]));
      }

      const { isAttacking } = detector.process(windowMax, currentTime);
      
      if (isAttacking && !attackTriggered) {
        attackTriggered = true;
        attackFrame = i;
      }
      
      currentTime += 10; // 10ms
    }

    expect(attackTriggered).toBe(true);
    
    // The attack in the fixture starts at 0.5s (sample 24000).
    // It should trigger very shortly after that.
    expect(attackFrame).toBeGreaterThan(23000); 
    expect(attackFrame).toBeLessThan(25000); 
  });
});

describe('StringLocker', () => {
  it('should maintain lock during jittery phase', () => {
    const fixturePath = path.resolve(__dirname, '../../tests/fixtures/pitch_jittery_boundary.json');
    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping fixture test: file not found.');
      return;
    }

    const pitches = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    // Threshold of 5 frames for testing (default is 15, but our jitter is short)
    const locker = new StringLocker(5);

    let lockedNotes: string[] = [];
    let rawNotes: string[] = [];

    for (const p of pitches) {
      // Clarity=1, Volume=1 to ensure valid detection
      const state = getTunerState(p, 1, 1);
      rawNotes.push(state.noteName);
      lockedNotes.push(locker.process(state.noteName));
    }

    // 1. Initial Phase (Frames 0-19): E2 (82.41) -> Note 'E'
    // Should lock to 'E' immediately
    expect(lockedNotes[10]).toBe('E');

    // 2. Jitter Phase (Frames 20-49): Alternating 95Hz (E) and 98Hz (A)
    // Raw notes should flip
    const jitterSlice = rawNotes.slice(20, 50);
    const hasE = jitterSlice.includes('E');
    const hasA = jitterSlice.includes('A');
    expect(hasE && hasA).toBe(true); // Verify raw input is indeed jittery

    // Locked notes should STAY 'E' because 'A' never sustains for > 5 frames
    const lockedJitterSlice = lockedNotes.slice(20, 50);
    const uniqueLocked = new Set(lockedJitterSlice);
    expect(uniqueLocked.size).toBe(1);
    expect(uniqueLocked.has('E')).toBe(true);

    // 3. Final Phase (Frames 50-69): A2 (110) -> Note 'A'
    // After 5 frames (threshold), it should switch.
    expect(lockedNotes[60]).toBe('A');
  });
});

describe('OctaveDiscriminator', () => {
    it('should prefer fundamental over 2nd harmonic when history bias is present', () => {
        const discriminator = new OctaveDiscriminator();
        
        // Scenario: We were just tuning E2
        discriminator.setLastNote('E');
        
        // We detect 164.82 (E3), which is a harmonic of E2
        const result = discriminator.process(164.82, 0.95);
        
        // It should return 82.41 (E2)
        expect(result).toBeCloseTo(82.41, 1);
    });
});

describe('NoiseGate', () => {
    it('should ignore rising background noise and trigger on pluck', () => {
        const fixturePath = path.resolve(__dirname, '../../tests/fixtures/noise_floor_rise.json');
        if (!fs.existsSync(fixturePath)) {
            console.warn('Skipping fixture test: file not found.');
            return;
        }

        const buffer = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
        const gate = new NoiseGate();
        // Force a very fast alpha for this specific test so it can keep up with the 1s rise
        (gate as any).alpha = 0.8;
        
        const stepSize = 480; 
        let openIndices: number[] = [];
        
        for (let i = 0; i < buffer.length; i += stepSize) {
            let windowMax = 0;
            for (let j = 0; j < stepSize && (i + j) < buffer.length; j++) {
                windowMax = Math.max(windowMax, Math.abs(buffer[i+j]));
            }

            // Assume clarity is low during noise, high during pluck
            const isPluck = (i > 1.5 * 48000 && i < 1.7 * 48000);
            const clarity = isPluck ? 0.98 : 0.3;
            
            const isOpen = gate.process(windowMax, clarity);
            if (isOpen) {
                openIndices.push(i);
            }
        }

        // Noise phase (0-1.5s): 
        // We expect it to be CLOSED just before the pluck starts (e.g. at 1.4s)
        const closedJustBeforePluck = openIndices.filter(idx => idx > 1.2 * 48000 && idx < 1.5 * 48000);
        expect(closedJustBeforePluck.length).toBe(0); 
        
        // Pluck phase (1.5s-1.7s): Gate MUST open
        const pluckPhaseOpen = openIndices.filter(idx => idx >= 1.5 * 48000 && idx < 1.7 * 48000);
        expect(pluckPhaseOpen.length).toBeGreaterThan(0);
    });
});

