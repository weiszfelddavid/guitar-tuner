export interface Tuning {
  instrument: string;
  slug: string;
  name: string;
  notes: string[];
}

export const TUNINGS: Tuning[] = [
  // --- Guitar ---
  {
    instrument: "guitar",
    slug: "standard",
    name: "Guitar (Standard)",
    notes: ["E2", "A2", "D3", "G3", "B3", "E4"]
  },
  {
    instrument: "guitar",
    slug: "drop-d",
    name: "Guitar (Drop D)",
    notes: ["D2", "A2", "D3", "G3", "B3", "E4"]
  },
  {
    instrument: "guitar",
    slug: "open-g",
    name: "Guitar (Open G)",
    notes: ["D2", "G2", "D3", "G3", "B3", "D4"]
  },
  {
    instrument: "guitar",
    slug: "dadgad",
    name: "Guitar (DADGAD)",
    notes: ["D2", "A2", "D3", "G3", "A3", "D4"]
  },
  {
    instrument: "guitar",
    slug: "half-step-down",
    name: "Guitar (Half-Step Down)",
    notes: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"]
  },
  // --- Bass ---
  {
    instrument: "bass",
    slug: "standard",
    name: "Bass (Standard)",
    notes: ["E1", "A1", "D2", "G2"]
  },
  {
    instrument: "bass",
    slug: "five-string",
    name: "Bass (5-String)",
    notes: ["B0", "E1", "A1", "D2", "G2"]
  },
  // --- Ukulele ---
  {
    instrument: "ukulele",
    slug: "standard",
    name: "Ukulele (Standard)",
    notes: ["G4", "C4", "E4", "A4"]
  },
  {
    instrument: "ukulele",
    slug: "low-g",
    name: "Ukulele (Low G)",
    notes: ["G3", "C4", "E4", "A4"]
  },
  // --- Orchestral ---
  {
    instrument: "cello",
    slug: "standard",
    name: "Cello (Standard)",
    notes: ["C2", "G2", "D3", "A3"]
  },
  // --- Voice ---
  {
    instrument: "voice",
    slug: "humming",
    name: "Voice (Humming)",
    notes: [] // Dynamic range handling
  }
];

// Helper to convert note names (E2 or Eb2) to frequencies
export function noteToFreq(noteName: string): number {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  
  // Handle flats (Eb -> D#)
  const flats: Record<string, string> = {
    "Db": "C#",
    "Eb": "D#",
    "Gb": "F#",
    "Ab": "G#",
    "Bb": "A#"
  };

  let name = noteName.slice(0, -1);
  const octave = parseInt(noteName.slice(-1));

  if (flats[name]) {
    name = flats[name];
  }

  const semitones = notes.indexOf(name) + (octave + 1) * 12;
  return 440 * Math.pow(2, (semitones - 69) / 12);
}
