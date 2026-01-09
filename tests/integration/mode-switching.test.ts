/**
 * Mode Switching Integration Tests
 *
 * Tests that mode switching between strict and forgiving modes works correctly
 * and affects signal processing as expected.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultConfig,
  getTunerState,
  VisualHoldManager,
  TunerMode
} from '../../src/ui/tuner';
import {
  STRICT_HOLD_DURATION_MS,
  FORGIVING_HOLD_DURATION_MS
} from '../../src/constants/tuner-config';

describe('Mode Switching Integration Tests', () => {
  describe('Configuration Switching', () => {
    it('should return strict config with correct thresholds', () => {
      const config = getDefaultConfig('strict');

      expect(config.mode).toBe('strict');
      expect(config.clarityThreshold).toBe(0.9);
      expect(config.smoothingFactor).toBe(0.1);
    });

    it('should return forgiving config with correct thresholds', () => {
      const config = getDefaultConfig('forgiving');

      expect(config.mode).toBe('forgiving');
      expect(config.clarityThreshold).toBe(0.6);
      expect(config.smoothingFactor).toBe(0.3);
    });
  });

  describe('Clarity Threshold Differences', () => {
    const testPitch = 110.0; // A2
    const testVolume = 0.5;

    it('strict mode rejects breathy signal (clarity 0.65)', () => {
      const strictConfig = getDefaultConfig('strict');
      const breathyClarity = 0.65;

      const state = getTunerState(testPitch, breathyClarity, testVolume, strictConfig);

      expect(state.noteName).toBe('--');
      expect(state.clarity).toBe(breathyClarity);
    });

    it('forgiving mode accepts breathy signal (clarity 0.65)', () => {
      const forgivingConfig = getDefaultConfig('forgiving');
      const breathyClarity = 0.65;

      const state = getTunerState(testPitch, breathyClarity, testVolume, forgivingConfig);

      expect(state.noteName).toBe('A2');
      expect(state.clarity).toBe(breathyClarity);
    });

    it('both modes accept clean signal (clarity 0.95)', () => {
      const strictConfig = getDefaultConfig('strict');
      const forgivingConfig = getDefaultConfig('forgiving');
      const cleanClarity = 0.95;

      const strictState = getTunerState(testPitch, cleanClarity, testVolume, strictConfig);
      const forgivingState = getTunerState(testPitch, cleanClarity, testVolume, forgivingConfig);

      expect(strictState.noteName).toBe('A2');
      expect(forgivingState.noteName).toBe('A2');
    });

    it('both modes reject very poor signal (clarity 0.3)', () => {
      const strictConfig = getDefaultConfig('strict');
      const forgivingConfig = getDefaultConfig('forgiving');
      const poorClarity = 0.3;

      const strictState = getTunerState(testPitch, poorClarity, testVolume, strictConfig);
      const forgivingState = getTunerState(testPitch, poorClarity, testVolume, forgivingConfig);

      expect(strictState.noteName).toBe('--');
      expect(forgivingState.noteName).toBe('--');
    });
  });

  describe('Visual Hold Duration Differences', () => {
    let holdManager: VisualHoldManager;

    beforeEach(() => {
      holdManager = new VisualHoldManager();
    });

    it('strict mode holds note for 400ms', () => {
      const validState = {
        noteName: 'E2',
        cents: -5,
        clarity: 0.95,
        volume: 0.5,
        isLocked: false,
        frequency: 82.41,
        isAttacking: false
      };

      const dropoutState = {
        noteName: '--',
        cents: 0,
        clarity: 0.3,
        volume: 0.5,
        isLocked: false,
        frequency: 0,
        isAttacking: false
      };

      const startTime = 1000;

      // Process valid state
      holdManager.process(validState, 0.5, 'strict', startTime);

      // Signal drops - should hold briefly
      const result300ms = holdManager.process(dropoutState, 0.5, 'strict', startTime + 300);
      expect(result300ms.noteName).toBe('E2'); // Within 400ms window

      // After 400ms - should drop
      const result500ms = holdManager.process(dropoutState, 0.5, 'strict', startTime + 500);
      expect(result500ms.noteName).toBe('--'); // Beyond 400ms window
    });

    it('forgiving mode holds note for 4 seconds', () => {
      const validState = {
        noteName: 'E2',
        cents: -5,
        clarity: 0.7,
        volume: 0.5,
        isLocked: false,
        frequency: 82.41,
        isAttacking: false
      };

      const dropoutState = {
        noteName: '--',
        cents: 0,
        clarity: 0.3,
        volume: 0.5,
        isLocked: false,
        frequency: 0,
        isAttacking: false
      };

      const startTime = 1000;

      // Process valid state
      holdManager.process(validState, 0.5, 'forgiving', startTime);

      // Signal drops - should hold for 4 seconds
      const result1s = holdManager.process(dropoutState, 0.5, 'forgiving', startTime + 1000);
      expect(result1s.noteName).toBe('E2');

      const result3s = holdManager.process(dropoutState, 0.5, 'forgiving', startTime + 3000);
      expect(result3s.noteName).toBe('E2');

      // After 4 seconds - should drop
      const result4500ms = holdManager.process(dropoutState, 0.5, 'forgiving', startTime + 4500);
      expect(result4500ms.noteName).toBe('--');
    });

    it('hold duration constants match actual behavior', () => {
      expect(STRICT_HOLD_DURATION_MS).toBe(400);
      expect(FORGIVING_HOLD_DURATION_MS).toBe(4000);
    });
  });

  describe('Mode Switching During Operation', () => {
    it('should immediately apply new clarity threshold after mode switch', () => {
      const testPitch = 110.0;
      const breathyClarity = 0.65;
      const testVolume = 0.5;

      // Start in strict mode - should reject
      let config = getDefaultConfig('strict');
      let state = getTunerState(testPitch, breathyClarity, testVolume, config);
      expect(state.noteName).toBe('--');

      // Switch to forgiving mode - should accept
      config = getDefaultConfig('forgiving');
      state = getTunerState(testPitch, breathyClarity, testVolume, config);
      expect(state.noteName).toBe('A2');

      // Switch back to strict - should reject again
      config = getDefaultConfig('strict');
      state = getTunerState(testPitch, breathyClarity, testVolume, config);
      expect(state.noteName).toBe('--');
    });
  });
});
