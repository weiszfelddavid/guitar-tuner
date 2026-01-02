export interface Tuning {
  instrument: string;
  slug: string;
  name: string;
  notes: string[]; // e.g., ["E2", "A2", "D3", "G3", "B3", "E4"]
}

export const TUNINGS: Tuning[] = [
  {
    instrument: "guitar",
    slug: "standard",
    name: "Guitar (Standard)",
    notes: ["E2", "A2", "D3", "G3", "B3", "E4"],
  },
  {
    instrument: "guitar",
    slug: "drop-d",
    name: "Guitar (Drop D)",
    notes: ["D2", "A2", "D3", "G3", "B3", "E4"],
  },
  {
    instrument: "bass",
    slug: "standard",
    name: "Bass (Standard)",
    notes: ["E1", "A1", "D2", "G2"],
  },
  {
    instrument: "ukulele",
    slug: "standard",
    name: "Ukulele",
    notes: ["G4", "C4", "E4", "A4"],
  },
  {
    instrument: "cello",
    slug: "standard",
    name: "Cello",
    notes: ["C2", "G2", "D3", "A3"],
  },
];

// Helper to convert note names (E2) to frequencies
export function noteToFreq(noteName: string): number {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = noteName.slice(0, -1);
  const octave = parseInt(noteName.slice(-1));
  const semitones = notes.indexOf(name) + (octave + 1) * 12;
  return 440 * Math.pow(2, (semitones - 69) / 12);
}