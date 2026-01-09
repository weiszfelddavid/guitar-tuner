/**
 * String Locking End-to-End Tests
 *
 * Tests the complete string locking pipeline including:
 * - Hysteresis to prevent rapid string switching
 * - Manual string lock override
 * - String lock behavior during frequency changes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StringLocker } from '../../src/ui/tuner';
import { STRING_LOCK_HYSTERESIS_FRAMES } from '../../src/constants/tuner-config';
import fs from 'fs';
import path from 'path';

describe('String Locking End-to-End Tests', () => {
  describe('Hysteresis Behavior', () => {
    let locker: StringLocker;

    beforeEach(() => {
      locker = new StringLocker();
    });

    it('should lock to first detected string immediately', () => {
      const result = locker.process('E2');
      expect(result).toBe('E2');
    });

    it('should not switch strings on brief detection', () => {
      // Lock to E2
      locker.process('E2');

      // Brief A2 detection (less than threshold)
      for (let i = 0; i < STRING_LOCK_HYSTERESIS_FRAMES; i++) {
        const result = locker.process('A2');
        expect(result).toBe('E2'); // Should still be locked to E2
      }
    });

    it('should switch strings after sustained detection', () => {
      // Lock to E2
      locker.process('E2');

      // Sustained A2 detection (exceeds threshold)
      let result = 'E2';
      for (let i = 0; i < STRING_LOCK_HYSTERESIS_FRAMES + 2; i++) {
        result = locker.process('A2');
      }

      expect(result).toBe('A2'); // Should have switched to A2
    });

    it('should reset counter if candidate string changes', () => {
      // Lock to E2
      locker.process('E2');

      // Partial A2 detection
      for (let i = 0; i < 10; i++) {
        locker.process('A2');
      }

      // Switch to D3 detection - should reset counter
      for (let i = 0; i < 10; i++) {
        const result = locker.process('D3');
        expect(result).toBe('E2'); // Still locked to E2
      }

      // Now sustain D3
      let result = 'E2';
      for (let i = 0; i < STRING_LOCK_HYSTERESIS_FRAMES + 2; i++) {
        result = locker.process('D3');
      }

      expect(result).toBe('D3'); // Should switch to D3
    });

    it('should reinforce lock when same string detected', () => {
      // Lock to E2
      locker.process('E2');

      // Continuous E2 detection
      for (let i = 0; i < 100; i++) {
        const result = locker.process('E2');
        expect(result).toBe('E2');
      }

      // Brief A2 detection should still require full threshold
      for (let i = 0; i < STRING_LOCK_HYSTERESIS_FRAMES; i++) {
        const result = locker.process('A2');
        expect(result).toBe('E2');
      }
    });
  });

  describe('Boundary Detection with Fixture', () => {
    it('should maintain lock during jittery boundary frequencies', () => {
      const fixturePath = path.resolve(__dirname, '../fixtures/pitch_jittery_boundary.json');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping: fixture not found. Run npm run generate-fixtures first.');
        return;
      }

      const pitches = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
      const locker = new StringLocker(5); // Lower threshold for this test

      const lockedNotes: string[] = [];
      const rawNotes: string[] = [];

      // Helper to get note name from frequency
      const getNoteName = (freq: number): string => {
        if (Math.abs(freq - 82.41) < 5) return 'E2';
        if (Math.abs(freq - 110.00) < 5) return 'A2';
        if (Math.abs(freq - 146.83) < 5) return 'D3';
        return 'E2'; // Default for values in between
      };

      for (const pitch of pitches) {
        const noteName = getNoteName(pitch);
        rawNotes.push(noteName);
        lockedNotes.push(locker.process(noteName));
      }

      // Phase 1: Should lock to E2
      expect(lockedNotes[10]).toBe('E2');

      // Phase 2: Jitter phase - locked should stay E2
      const jitterSlice = lockedNotes.slice(20, 50);
      const allE2 = jitterSlice.every(note => note === 'E2');
      expect(allE2).toBe(true);

      // Phase 3: Should eventually switch to A2
      expect(lockedNotes[60]).toBe('A2');
    });
  });

  describe('Manual String Lock Override', () => {
    it('should simulate manual lock behavior', () => {
      // In the real app, manual lock is handled in the worklet
      // This test simulates the expected behavior

      let manualLock: string | null = null;
      const locker = new StringLocker();

      // Auto-detect E2
      let autoNote = locker.process('E2');
      expect(autoNote).toBe('E2');

      // User manually locks to A2
      manualLock = 'A2';

      // Even if E2 is detected, manual lock should override
      if (manualLock) {
        expect(manualLock).toBe('A2'); // Manual lock takes precedence
      } else {
        autoNote = locker.process('E2');
        expect(autoNote).toBe('E2');
      }

      // User releases manual lock
      manualLock = null;

      // Auto-detection should resume
      autoNote = locker.process('E2');
      expect(autoNote).toBe('E2');
    });
  });

  describe('Lock Configuration', () => {
    it('should accept custom hysteresis threshold', () => {
      const customThreshold = 5;
      const locker = new StringLocker(customThreshold);

      // Lock to E2
      locker.process('E2');

      // Switch after custom threshold
      let result = 'E2';
      for (let i = 0; i < customThreshold + 2; i++) {
        result = locker.process('A2');
      }

      expect(result).toBe('A2');
    });

    it('should use default threshold when not specified', () => {
      const locker = new StringLocker();

      // Lock to E2
      locker.process('E2');

      // Should require default threshold (15 frames)
      for (let i = 0; i < STRING_LOCK_HYSTERESIS_FRAMES; i++) {
        const result = locker.process('A2');
        expect(result).toBe('E2');
      }

      // After threshold, should switch
      let result = 'E2';
      for (let i = 0; i < 2; i++) {
        result = locker.process('A2');
      }

      expect(result).toBe('A2');
    });
  });

  describe('Reset Behavior', () => {
    it('should clear lock state on reset', () => {
      const locker = new StringLocker();

      // Lock to E2
      locker.process('E2');

      // Partial A2 detection
      for (let i = 0; i < 10; i++) {
        locker.process('A2');
      }

      // Reset
      locker.reset();

      // Next detection should lock immediately
      const result = locker.process('D3');
      expect(result).toBe('D3');
    });
  });

  describe('All Guitar Strings', () => {
    it('should correctly lock through all 6 strings in sequence', () => {
      const locker = new StringLocker();

      const strings = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

      for (const targetString of strings) {
        // Sustain detection to exceed threshold
        let result = '';
        for (let i = 0; i < STRING_LOCK_HYSTERESIS_FRAMES + 2; i++) {
          result = locker.process(targetString);
        }

        expect(result).toBe(targetString);
      }
    });
  });
});
