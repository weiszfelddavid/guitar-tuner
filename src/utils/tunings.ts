export interface Tuning {
  instrument: string;
  slug: string;
  name: string;
  notes: string[];
  seoTitle: string;
  description: string;
  keywords: string[];
}

export const TUNINGS: Tuning[] = [
  // --- Guitar ---
  {
    instrument: "guitar",
    slug: "standard",
    name: "Guitar (Standard)",
    notes: ["E2", "A2", "D3", "G3", "B3", "E4"],
    seoTitle: "Standard Guitar Tuner | Precise Online Pitch Detector",
    description: "Tune your guitar to standard EADGBE tuning instantly. Our professional-grade microphone tuner works directly in your browser.",
    keywords: ["guitar tuner", "standard tuning", "online tuner", "eadgbe"]
  },
  {
    instrument: "guitar",
    slug: "drop-d",
    name: "Guitar (Drop D)",
    notes: ["D2", "A2", "D3", "G3", "B3", "E4"],
    seoTitle: "Drop D Guitar Tuner | Online Tuner for Rock & Metal",
    description: "Quickly tune your guitar to Drop D (DADGBE). Perfect for heavy riffs and rock music. Accurate, free, and easy to use.",
    keywords: ["drop d tuner", "guitar tuning", "dadgbe", "metal guitar"]
  },
  {
    instrument: "guitar",
    slug: "open-g",
    name: "Guitar (Open G)",
    notes: ["D2", "G2", "D3", "G3", "B3", "D4"],
    seoTitle: "Open G Guitar Tuner | Online Blues & Slide Tuner",
    description: "Tune your guitar to Open G (DGDGBD). The classic tuning for blues, slide guitar, and Rolling Stones riffs.",
    keywords: ["open g tuner", "dgdgbd", "blues guitar tuner", "slide tuning"]
  },
  {
    instrument: "guitar",
    slug: "dadgad",
    name: "Guitar (DADGAD)",
    notes: ["D2", "A2", "D3", "G3", "A3", "D4"],
    seoTitle: "DADGAD Guitar Tuner | Celtic & Acoustic Online Tuner",
    description: "Precision DADGAD tuning for your guitar. Ideal for Celtic music, fingerstyle, and rich acoustic resonances.",
    keywords: ["dadgad tuner", "celtic tuning", "acoustic guitar tuner"]
  },
  {
    instrument: "guitar",
    slug: "half-step-down",
    name: "Guitar (Half-Step Down)",
    notes: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
    seoTitle: "Half-Step Down Tuner | Eb Standard Guitar Tuning",
    description: "Tune your guitar one half-step down to Eb Standard. Great for reducing string tension and matching heavy vocal ranges.",
    keywords: ["half step down tuner", "eb tuning", "eb standard", "flat guitar tuner"]
  },
  // --- Bass ---
  {
    instrument: "bass",
    slug: "standard",
    name: "Bass (Standard)",
    notes: ["E1", "A1", "D2", "G2"],
    seoTitle: "Online Bass Guitar Tuner | Low Frequency Precision",
    description: "The most accurate online tuner for 4-string bass guitar. Capture low frequencies with high precision using your microphone.",
    keywords: ["bass tuner", "bass guitar", "standard bass tuning", "4 string bass"]
  },
  {
    instrument: "bass",
    slug: "five-string",
    name: "Bass (5-String)",
    notes: ["B0", "E1", "A1", "D2", "G2"],
    seoTitle: "5-String Bass Tuner | Low B String Pitch Detector",
    description: "Precision tuning for 5-string bass guitars, including the low B string. Optimized for deep sub-frequencies.",
    keywords: ["5 string bass tuner", "low b tuning", "extended range bass"]
  },
  // --- Ukulele ---
  {
    instrument: "ukulele",
    slug: "standard",
    name: "Ukulele (Standard)",
    notes: ["G4", "C4", "E4", "A4"],
    seoTitle: "Online Ukulele Tuner | Standard GCEA Tuning",
    description: "Tune your Soprano, Concert, or Tenor Ukulele to standard GCEA tuning instantly. Fast, free, and accurate.",
    keywords: ["ukulele tuner", "gcea", "uke tuner", "soprano ukulele"]
  },
  {
    instrument: "ukulele",
    slug: "low-g",
    name: "Ukulele (Low G)",
    notes: ["G3", "C4", "E4", "A4"],
    seoTitle: "Low G Ukulele Tuner | Linear GCEA Tuning Online",
    description: "Specifically designed for ukuleles with a Low G string. Achieve perfect linear tuning for your concert or tenor uke.",
    keywords: ["low g ukulele tuner", "low g tuning", "tenor ukulele"]
  },
  // --- Orchestral ---
  {
    instrument: "cello",
    slug: "standard",
    name: "Cello (Standard)",
    notes: ["C2", "G2", "D3", "A3"],
    seoTitle: "Online Cello Tuner | Precision Tuning for Cellists",
    description: "Fine-tune your cello to standard CGDA pitch. Works perfectly with long bow strokes or pizzicato plucking.",
    keywords: ["cello tuner", "cgda", "orchestral tuner", "cello pitch"]
  },
  // --- Voice ---
  {
    instrument: "voice",
    slug: "humming",
    name: "Voice (Humming)",
    notes: [], // Dynamic range handling
    seoTitle: "Vocal Pitch Monitor | Perfect Pitch Training",
    description: "Practice your pitch accuracy with our Voice mode. Real-time feedback for singers to master perfect pitch.",
    keywords: ["vocal tuner", "singing pitch", "perfect pitch", "voice training"]
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
