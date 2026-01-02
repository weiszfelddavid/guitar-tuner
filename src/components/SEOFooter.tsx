import React from 'react';
import './SEOFooter.css';
import { type Tuning, noteToFreq } from '../utils/tunings';

interface SEOFooterProps {
  tuning: Tuning;
}

const INSTRUMENT_DATA: Record<string, {
  title: string;
  desc: string;
  tips: string;
}> = {
  guitar: {
    title: "Free Online Guitar Tuner",
    desc: "Tune your acoustic or electric guitar instantly. Our precision microphone tuner detects strings automatically using advanced pitch detection algorithms.",
    tips: "For standard tuning (EADGBE), start with the thickest string (Low E) and work your way down to the thinnest (High E). If you are using new strings, stretch them gently and tune multiple times as they settle."
  },
  bass: {
    title: "Free Online Bass Tuner",
    desc: "The most accurate online tuner for bass guitars. Captures low fundamental frequencies with high precision, even on 5-string basses with a low B.",
    tips: "Bass frequencies can be hard for some built-in laptop microphones to pick up. Play the string firmly with your thumb or a pick to provide a clear signal for the detector."
  },
  ukulele: {
    title: "Free Online Ukulele Tuner",
    desc: "Tune your Soprano, Concert, or Tenor Ukulele in seconds. Supports Standard GCEA and Low G configurations.",
    tips: "Ukulele strings are made of nylon and are sensitive to temperature changes. You may need to tune more frequently if you are playing outdoors or under stage lights."
  },
  cello: {
    title: "Online Cello Tuner",
    desc: "Precision tuning for Cello (A-D-G-C). Optimized for the rich harmonics of orchestral string instruments.",
    tips: "Use long, steady bow strokes for the best detection. Ensure your bridge is properly aligned, as tension changes during tuning can occasionally cause it to lean."
  },
  default: {
    title: "Free Online Chromatic Tuner",
    desc: "A universal tuner for any stringed instrument. Professional-grade accuracy using your device's microphone.",
    tips: "Pluck the string clearly and let it ring. The tuner will automatically detect the nearest musical note and show you exactly how many cents you are off."
  }
};

export const SEOFooter: React.FC<SEOFooterProps> = ({ tuning }) => {
  const instrumentInfo = INSTRUMENT_DATA[tuning.instrument] || INSTRUMENT_DATA.default;

  return (
    <article className="seo-content">
      <section className="seo-section">
        <h1>{tuning.seoTitle}</h1>
        <p>
          {tuning.description} {instrumentInfo.desc}
        </p>
      </section>

      <section className="seo-section">
        <h2>{tuning.name} Frequencies (Hz)</h2>
        <p>
          Reference frequencies for <strong>{tuning.name}</strong> strings:
        </p>
        <table className="freq-table">
          <thead>
            <tr>
              <th>String</th>
              <th>Note</th>
              <th>Frequency (Hz)</th>
            </tr>
          </thead>
          <tbody>
            {[...tuning.notes].reverse().map((note, index) => (
              <tr key={`${tuning.slug}-${note}-${index}`}>
                <td>{tuning.notes.length - index}</td>
                <td>{note}</td>
                <td>{noteToFreq(note).toFixed(2)} Hz</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="seo-section">
        <h2>Pro Tips for {tuning.name}</h2>
        <p>{instrumentInfo.tips}</p>
        <ol className="tuning-steps">
          <li><strong>Enable Microphone:</strong> Click the "Tap to enable" overlay to grant access to your mic.</li>
          <li><strong>Select Instrument:</strong> Ensure "{tuning.name}" is active in the menu.</li>
          <li><strong>Pluck Clearly:</strong> Sound a single string. The tuner will highlight the closest note.</li>
          <li><strong>Check the Needle:</strong>
            <ul>
              <li><strong>Flat (Left):</strong> The pitch is too low. Tighten the tuning peg.</li>
              <li><strong>Sharp (Right):</strong> The pitch is too high. Loosen the tuning peg.</li>
            </ul>
          </li>
          <li><strong>Diamond Mode:</strong> When the center diamond glows green, you are perfectly in tune (within 4 cents).</li>
        </ol>
      </section>
    </article>
  );
};
