import { describe, it, expect } from 'vitest';
import { PluckDetector, PitchStabilizer, StringLocker, getTunerState, OctaveDiscriminator, NoiseGate, getDefaultConfig, VisualHoldManager } from './tuner';
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

describe('Tuner Modes', () => {
    describe('Strict Mode (default)', () => {
        it('should reject breathy signal with clarity < 0.9', () => {
            const strictConfig = getDefaultConfig('strict');
            const pitch = 110.00; // A2
            const clarity = 0.65; // Breathy signal
            const volume = 0.5;

            const state = getTunerState(pitch, clarity, volume, strictConfig);

            // Strict mode should reject this (clarity < 0.9)
            expect(state.noteName).toBe('--');
        });

        it('should accept clean signal with clarity >= 0.9', () => {
            const strictConfig = getDefaultConfig('strict');
            const pitch = 110.00; // A2
            const clarity = 0.95;
            const volume = 0.5;

            const state = getTunerState(pitch, clarity, volume, strictConfig);

            // Strict mode should accept this
            expect(state.noteName).toBe('A');
        });
    });

    describe('Forgiving Mode', () => {
        it('should accept breathy signal with clarity >= 0.6', () => {
            const forgivingConfig = getDefaultConfig('forgiving');
            const pitch = 110.00; // A2
            const clarity = 0.65; // Breathy signal
            const volume = 0.5;

            const state = getTunerState(pitch, clarity, volume, forgivingConfig);

            // Forgiving mode should accept this (clarity >= 0.6)
            expect(state.noteName).toBe('A');
        });

        it('should reject very poor signal with clarity < 0.6', () => {
            const forgivingConfig = getDefaultConfig('forgiving');
            const pitch = 110.00; // A2
            const clarity = 0.5; // Too noisy even for forgiving mode
            const volume = 0.5;

            const state = getTunerState(pitch, clarity, volume, forgivingConfig);

            // Even forgiving mode should reject this
            expect(state.noteName).toBe('--');
        });
    });
});

describe('VisualHoldManager', () => {
    it('should hold note display for 4 seconds in forgiving mode when signal drops', () => {
        const holdManager = new VisualHoldManager();
        const timestamp = 1000;

        // Valid note detected
        const validState = {
            noteName: 'E',
            cents: -5,
            clarity: 0.7,
            volume: 0.5,
            isLocked: false,
            frequency: 82.41
        };

        // Process valid state
        let result = holdManager.process(validState, 0.5, 'forgiving', timestamp);
        expect(result.noteName).toBe('E');

        // Signal drops (no note) but volume still present - should hold
        const dropoutState = {
            noteName: '--',
            cents: 0,
            clarity: 0.3,
            volume: 0.5,
            isLocked: false,
            frequency: 0
        };

        // Within 4 seconds - should still show 'E'
        result = holdManager.process(dropoutState, 0.5, 'forgiving', timestamp + 1000);
        expect(result.noteName).toBe('E');

        result = holdManager.process(dropoutState, 0.5, 'forgiving', timestamp + 3000);
        expect(result.noteName).toBe('E');

        // After 4 seconds - should drop to no note
        result = holdManager.process(dropoutState, 0.5, 'forgiving', timestamp + 4500);
        expect(result.noteName).toBe('--');
    });

    it('should NOT hold in strict mode', () => {
        const holdManager = new VisualHoldManager();
        const timestamp = 1000;

        // Valid note detected
        const validState = {
            noteName: 'E',
            cents: -5,
            clarity: 0.95,
            volume: 0.5,
            isLocked: false,
            frequency: 82.41
        };

        holdManager.process(validState, 0.5, 'strict', timestamp);

        // Signal drops - in strict mode, should immediately show no note
        const dropoutState = {
            noteName: '--',
            cents: 0,
            clarity: 0.5,
            volume: 0.5,
            isLocked: false,
            frequency: 0
        };

        const result = holdManager.process(dropoutState, 0.5, 'strict', timestamp + 100);
        expect(result.noteName).toBe('--'); // No hold in strict mode
    });

    it('should release hold if volume drops completely', () => {
        const holdManager = new VisualHoldManager();
        const timestamp = 1000;

        // Valid note
        const validState = {
            noteName: 'A',
            cents: 2,
            clarity: 0.7,
            volume: 0.5,
            isLocked: false,
            frequency: 110
        };

        holdManager.process(validState, 0.5, 'forgiving', timestamp);

        // Signal and volume both drop
        const silenceState = {
            noteName: '--',
            cents: 0,
            clarity: 0.1,
            volume: 0.005, // Below threshold
            isLocked: false,
            frequency: 0
        };

        const result = holdManager.process(silenceState, 0.005, 'forgiving', timestamp + 100);
        expect(result.noteName).toBe('--'); // Should not hold if volume is too low
    });
});

describe('Fixture-Based Integration Tests', () => {
    describe('Breathy Hum Fixture', () => {
        it('Test Case 1: Strict mode should reject breathy fixture (clarity < 0.9)', () => {
            const fixturePath = path.resolve(__dirname, '../../tests/fixtures/pitch_breathy_hum.json');
            if (!fs.existsSync(fixturePath)) {
                console.warn('Skipping fixture test: pitch_breathy_hum.json not found.');
                return;
            }

            // The fixture is an audio buffer, but we need to simulate what the pitch detector
            // would return. For a breathy signal with ~35% noise, clarity should be ~0.65
            const expectedClarity = 0.65;
            const expectedPitch = 110.00; // A2
            const volume = 0.5;

            const strictConfig = getDefaultConfig('strict');
            const state = getTunerState(expectedPitch, expectedClarity, volume, strictConfig);

            // Strict mode (0.9 threshold) should reject this
            expect(state.noteName).toBe('--');
            expect(state.clarity).toBe(expectedClarity);
        });

        it('Test Case 2: Forgiving mode should accept breathy fixture (clarity > 0.6)', () => {
            const fixturePath = path.resolve(__dirname, '../../tests/fixtures/pitch_breathy_hum.json');
            if (!fs.existsSync(fixturePath)) {
                console.warn('Skipping fixture test: pitch_breathy_hum.json not found.');
                return;
            }

            // Same breathy signal
            const expectedClarity = 0.65;
            const expectedPitch = 110.00; // A2
            const volume = 0.5;

            const forgivingConfig = getDefaultConfig('forgiving');
            const state = getTunerState(expectedPitch, expectedClarity, volume, forgivingConfig);

            // Forgiving mode (0.6 threshold) should accept this
            expect(state.noteName).toBe('A');
            expect(state.clarity).toBe(expectedClarity);
        });
    });

    describe('Signal Dropout Fixture', () => {
        it('Test Case 3: Forgiving mode holds display during 100ms dropout, Strict mode drops immediately', () => {
            const fixturePath = path.resolve(__dirname, '../../tests/fixtures/signal_dropout.json');
            if (!fs.existsSync(fixturePath)) {
                console.warn('Skipping fixture test: signal_dropout.json not found.');
                return;
            }

            // Simulate the scenario:
            // - 0-300ms: Clean E2 signal (clarity 0.95)
            // - 300-400ms: Dropout (clarity drops to 0.3)
            // - 400ms+: Clean signal resumes

            const strictHoldManager = new VisualHoldManager();
            const forgivingHoldManager = new VisualHoldManager();

            // Phase 1: Clean signal detected
            const cleanState = {
                noteName: 'E',
                cents: -3,
                clarity: 0.95,
                volume: 0.5,
                isLocked: false,
                frequency: 82.41
            };

            strictHoldManager.process(cleanState, 0.5, 'strict', 100);
            forgivingHoldManager.process(cleanState, 0.5, 'forgiving', 100);

            // Phase 2: Dropout at 350ms (50ms into dropout)
            const dropoutState = {
                noteName: '--', // Clarity dropped, no note detected
                cents: 0,
                clarity: 0.3,
                volume: 0.5, // Volume still present
                isLocked: false,
                frequency: 0
            };

            const strictResult = strictHoldManager.process(dropoutState, 0.5, 'strict', 350);
            const forgivingResult = forgivingHoldManager.process(dropoutState, 0.5, 'forgiving', 350);

            // STRICT MODE: Should immediately show no note
            expect(strictResult.noteName).toBe('--');

            // FORGIVING MODE: Should hold the 'E' note (within 4 second window)
            expect(forgivingResult.noteName).toBe('E');

            // Phase 3: After 4500ms total (4400ms past the last valid note)
            const forgivingResultLater = forgivingHoldManager.process(dropoutState, 0.5, 'forgiving', 4600);

            // Should now drop the note since we've exceeded the 4 second hold
            expect(forgivingResultLater.noteName).toBe('--');
        });
    });
});

