import { describe, it, expect } from 'vitest';
import { PluckDetector, PitchStabilizer } from './tuner';
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
