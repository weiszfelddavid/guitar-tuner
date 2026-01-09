/**
 * WASM ↔ TypeScript Integration Tests
 *
 * Tests the integration between the WASM pitch detection module and TypeScript code.
 * Verifies that pitch detection works correctly with real audio data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import init, { PitchDetector } from '../../src/audio/pure_tone_lib.mjs';
import fs from 'fs';
import path from 'path';

describe('WASM Integration Tests', () => {
  let detector: PitchDetector;
  const SAMPLE_RATE = 48000;
  const BUFFER_SIZE = 4096;

  beforeAll(async () => {
    // Initialize WASM module
    const wasmPath = path.resolve(__dirname, '../../dist/pure_tone_bg.wasm');

    if (!fs.existsSync(wasmPath)) {
      console.warn('WASM file not found. Run "npm run build" first.');
      return;
    }

    const wasmBytes = fs.readFileSync(wasmPath);
    await init(wasmBytes);
    detector = new PitchDetector(SAMPLE_RATE, BUFFER_SIZE);
  });

  it('should initialize WASM module successfully', () => {
    expect(detector).toBeDefined();
  });

  it('should detect E2 string frequency (82.41 Hz)', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/pluck_E2.json');

    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping: fixture not found. Run npm run generate-fixtures first.');
      return;
    }

    const audioBuffer = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    // Process a chunk from the sustain phase (after initial attack)
    // Attack is at ~0.5s (sample 24000), process at 0.6s (sample 28800)
    const sustainStart = 28800;
    const chunk = new Float32Array(audioBuffer.slice(sustainStart, sustainStart + BUFFER_SIZE));

    const result = detector.process(chunk);

    expect(result.pitch).toBeGreaterThan(80);
    expect(result.pitch).toBeLessThan(86); // Allow for slight detection variation
    expect(result.clarity).toBeGreaterThan(0.8);
  });

  it('should detect A2 string frequency (110 Hz)', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/pure_A2.json');

    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping: fixture not found. Run npm run generate-fixtures first.');
      return;
    }

    const audioBuffer = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const chunk = new Float32Array(audioBuffer.slice(0, BUFFER_SIZE));

    const result = detector.process(chunk);

    expect(result.pitch).toBeGreaterThan(108);
    expect(result.pitch).toBeLessThan(112);
    expect(result.clarity).toBeGreaterThan(0.9);
  });

  it('should return low clarity for noise', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/noise_floor_rise.json');

    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping: fixture not found. Run npm run generate-fixtures first.');
      return;
    }

    const audioBuffer = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    // Process noise phase (0-1.5s)
    const noiseChunk = new Float32Array(audioBuffer.slice(24000, 24000 + BUFFER_SIZE));

    const result = detector.process(noiseChunk);

    // Noise should have low clarity
    expect(result.clarity).toBeLessThan(0.5);
  });

  it('should handle silence gracefully', () => {
    const silentBuffer = new Float32Array(BUFFER_SIZE).fill(0);

    const result = detector.process(silentBuffer);

    expect(result.pitch).toBeDefined();
    expect(result.clarity).toBeDefined();
    expect(result.clarity).toBe(0);
  });

  it('should process multiple consecutive chunks', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/pure_A2.json');

    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping: fixture not found. Run npm run generate-fixtures first.');
      return;
    }

    const audioBuffer = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    // Process 3 consecutive chunks
    for (let i = 0; i < 3; i++) {
      const offset = i * BUFFER_SIZE;
      const chunk = new Float32Array(audioBuffer.slice(offset, offset + BUFFER_SIZE));

      const result = detector.process(chunk);

      expect(result.pitch).toBeGreaterThan(108);
      expect(result.pitch).toBeLessThan(112);
      expect(result.clarity).toBeGreaterThan(0.85);
    }
  });
});
