export const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface NoteData {
  note: string;
  cents: number;
}

export function getNoteFromPitch(frequency: number): NoteData {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  const roundedNote = Math.round(noteNum) + 69;
  
  const noteIndex = roundedNote % 12;
  const note = NOTE_STRINGS[noteIndex];
  
  // Calculate cents difference
  // Formula: 1200 * log2(f1 / f2)
  // f2 is the exact frequency of the target note
  const exactFreq = 440 * Math.pow(2, (roundedNote - 69) / 12);
  const cents = 1200 * (Math.log(frequency / exactFreq) / Math.log(2));
  
  return {
    note,
    cents
  };
}

export function getNoteDetails(frequency: number) {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  const roundedNote = Math.round(noteNum) + 69;
  const noteIndex = roundedNote % 12;
  const octave = Math.floor(roundedNote / 12) - 1;
  return {
    note: NOTE_STRINGS[noteIndex],
    octave
  };
}
