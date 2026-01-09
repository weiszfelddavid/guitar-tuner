import { GUITAR_STRINGS, type GuitarString } from '../constants/guitar-strings';

/**
 * Find the guitar string closest to the given frequency
 * @param frequency - Frequency in Hz
 * @param strings - Array of guitar strings (defaults to standard tuning)
 * @returns The closest guitar string
 */
export function findClosestString(
  frequency: number,
  strings: readonly GuitarString[] = GUITAR_STRINGS
): GuitarString {
  let closestString = strings[0];
  let minDiff = Math.abs(frequency - closestString.frequency);

  for (const str of strings) {
    const diff = Math.abs(frequency - str.frequency);
    if (diff < minDiff) {
      minDiff = diff;
      closestString = str;
    }
  }

  return closestString;
}

/**
 * Calculate the difference in cents between a frequency and a reference frequency
 * One octave = 1200 cents, one semitone = 100 cents
 * @param frequency - Frequency to measure
 * @param referenceFrequency - Reference frequency (e.g., target note frequency)
 * @returns Difference in cents (positive = sharp, negative = flat)
 */
export function calculateCents(frequency: number, referenceFrequency: number): number {
  return 1200 * Math.log2(frequency / referenceFrequency);
}
