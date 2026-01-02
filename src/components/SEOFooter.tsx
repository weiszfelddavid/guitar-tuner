import React from 'react';
import './SEOFooter.css';
import { type Tuning, noteToFreq } from '../utils/tunings';

interface SEOFooterProps {
  tuning: Tuning;
}

// Content definitions for each instrument category
const INSTRUMENT_CONTENT: Record<string, {
  title: string;
  desc: string;
  tips: string;
}> = {
  Guitar: {
    title: "Free Online Guitar Tuner",
    desc: "Tune your acoustic or electric guitar instantly. Our precision microphone tuner detects strings automatically.",
    tips: "For standard tuning (EADGBE), start with the thickest string (Low E) and work your way down to the thinnest (High E). Ensure your environment is quiet for the best results."
  },
  Bass: {
    title: "Free Online Bass Tuner",
    desc: "The most accurate online tuner for 4-string and 5-string bass guitars. Captures low frequencies with high precision.",
    tips: "Bass frequencies can be hard for some microphones to pick up. Play the string firmly but avoid the 'slap' sound to help the tuner lock onto the fundamental pitch."
  },
  Ukulele: {
    title: "Free Online Ukulele Tuner",
    desc: "Tune your Soprano, Concert, or Tenor Ukulele in seconds. Supports Standard GCEA tuning.",
    tips: "Ukulele strings are nylon and stretch easily. You may need to tune multiple times in a row if you have fresh strings. Standard tuning is G-C-E-A (High G)."
  },
  Cello: {
    title: "Online Cello Tuner",
    desc: "Precision tuning for Cello (A-D-G-C). Works perfectly with your device's microphone.",
    tips: "Use long, steady bow strokes for the best detection. Plucking (pizzicato) works too, but bowing gives a clearer sustained tone for the tuner."
  },
  Default: {
    title: "Free Online Chromatic Tuner",
    desc: "A universal tuner for any stringed instrument. Guitar, Bass, Ukulele, Violin, and more.",
    tips: "Select your specific instrument from the menu above for specialized guidance, or use this chromatic mode to detect any note."
  }
};

export const SEOFooter: React.FC<SEOFooterProps> = ({ tuning }) => {
  // Determine instrument type from tuning name (e.g. "Guitar (Drop D)" -> "Guitar")
  const instrumentType = Object.keys(INSTRUMENT_CONTENT).find(key => tuning.name.includes(key)) || 'Default';
  const content = INSTRUMENT_CONTENT[instrumentType];

  return (
    <article className="seo-content">
      <section className="seo-section">
        <h1>{content.title} ({tuning.name})</h1>
        <p>
          {content.desc} Using advanced audio processing, this tool locks onto your 
          <strong> {instrumentType}</strong> strings directly through your browser. 
          No app download required.
        </p>
      </section>

      <section className="seo-section">
        <h2>{instrumentType} Tuning Frequencies (Hz)</h2>
        <p>
          Reference frequencies for <strong>{tuning.name}</strong>:
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
              <tr key={note}>
                <td>{index + 1}</td>
                <td>{note}</td>
                <td>{noteToFreq(note).toFixed(2)} Hz</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="seo-section">
        <h2>Pro Tips for Tuning {instrumentType}</h2>
        <p>{content.tips}</p>
        <ol className="tuning-steps">
          <li><strong>Enable Mic:</strong> Tap to start the tuner.</li>
          <li><strong>Select String:</strong> Pluck the string you want to tune. The visualizer will highlight the nearest note.</li>
          <li><strong>Fine Tune:</strong>
            <ul>
              <li><strong>Needle Left:</strong> Pitch is Flat (Too Low). Tighten the tuning peg.</li>
              <li><strong>Needle Right:</strong> Pitch is Sharp (Too High). Loosen the tuning peg.</li>
            </ul>
          </li>
          <li><strong>Diamond Mode:</strong> When the diamond icon glows green, you are perfectly locked in.</li>
        </ol>
      </section>
    </article>
  );
};