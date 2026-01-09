// src/constants/guitar-strings.ts
// Single source of truth for guitar string definitions

export interface GuitarString {
  note: string;           // Note name with octave (e.g., 'E2', 'A2')
  label: string;          // Human-readable label (e.g., 'Low E', 'A')
  frequency: number;      // Target frequency in Hz (e.g., 82.41)
  stringNumber: number;   // String number 1-6 (1 = high E, 6 = low E)
  id: string;            // DOM element ID (e.g., 'string-6')
}

/**
 * Standard E tuning for 6-string guitar
 * Strings ordered from lowest (E2) to highest (E4)
 */
export const GUITAR_STRINGS: Readonly<GuitarString[]> = [
  { note: 'E2', label: 'Low E', frequency: 82.41, stringNumber: 6, id: 'string-6' },
  { note: 'A2', label: 'A', frequency: 110.00, stringNumber: 5, id: 'string-5' },
  { note: 'D3', label: 'D', frequency: 146.83, stringNumber: 4, id: 'string-4' },
  { note: 'G3', label: 'G', frequency: 196.00, stringNumber: 3, id: 'string-3' },
  { note: 'B3', label: 'B', frequency: 246.94, stringNumber: 2, id: 'string-2' },
  { note: 'E4', label: 'High E', frequency: 329.63, stringNumber: 1, id: 'string-1' },
] as const;

/**
 * Get string information by note name
 * @param noteName - Note name with octave (e.g., 'E2', 'A2')
 * @returns String info or null if not found
 */
export function getStringByNote(noteName: string): GuitarString | null {
  return GUITAR_STRINGS.find(s => s.note === noteName) || null;
}

/**
 * Get string information by string number
 * @param stringNumber - String number 1-6 (1 = high E, 6 = low E)
 * @returns String info or null if not found
 */
export function getStringByNumber(stringNumber: number): GuitarString | null {
  return GUITAR_STRINGS.find(s => s.stringNumber === stringNumber) || null;
}

/**
 * Get string information by DOM ID
 * @param id - DOM element ID (e.g., 'string-6')
 * @returns String info or null if not found
 */
export function getStringById(id: string): GuitarString | null {
  return GUITAR_STRINGS.find(s => s.id === id) || null;
}
