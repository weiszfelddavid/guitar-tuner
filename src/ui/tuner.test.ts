import { describe, it, expect } from 'vitest';
import { PluckDetector } from './tuner';

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
});
