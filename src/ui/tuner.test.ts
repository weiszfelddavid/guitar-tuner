import { describe, it, expect, vi } from 'vitest';
import { TransientMasker } from './tuner';

describe('TransientMasker', () => {
  it('should mask detection immediately after a volume jump', () => {
    const masker = new TransientMasker();
    const now = 1000;

    // Silence
    expect(masker.process(0.001, now)).toBe(false);

    // Pluck (Volume jump from 0.001 to 0.1)
    expect(masker.process(0.1, now)).toBe(true);
    
    // Still masking after 100ms
    expect(masker.process(0.09, now + 100)).toBe(true);

    // Finished masking after 201ms
    expect(masker.process(0.08, now + 201)).toBe(false);
  });

  it('should not mask if volume is steady', () => {
    const masker = new TransientMasker();
    const now = 1000;

    // Initial pluck
    masker.process(0.1, now);
    
    // Fast forward past mask
    masker.process(0.1, now + 300);
    expect(masker.process(0.11, now + 350)).toBe(false);
  });
});
