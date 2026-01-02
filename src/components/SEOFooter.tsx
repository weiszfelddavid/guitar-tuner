import React from 'react';
import './SEOFooter.css';

export const SEOFooter: React.FC = () => {
  return (
    <article className="seo-content">
      <section className="seo-section">
        <h2>Free Online Guitar Tuner</h2>
        <p>
          Welcome to the most accurate <strong>free online guitar tuner</strong>. 
          Our tool uses advanced audio processing technology to detect the pitch of your instrument 
          directly through your device's microphone. No app download is required—simply tap "Start" 
          and play a string.
        </p>
        <p>
          Whether you play <strong>Acoustic Guitar</strong>, <strong>Electric Guitar</strong>, 
          <strong>Bass</strong>, or <strong>Ukulele</strong>, this tuner automatically detects 
          the note you are playing and guides you to the perfect pitch with precision accuracy.
        </p>
      </section>

      <section className="seo-section">
        <h2>How to Tune Your Guitar</h2>
        <ol className="tuning-steps">
          <li><strong>Enable Microphone:</strong> Tap the screen to allow microphone access.</li>
          <li><strong>Select Instrument:</strong> Choose between Standard Guitar, Drop D, Bass, or Ukulele from the top menu.</li>
          <li><strong>Play a String:</strong> Pluck one string at a time. The tuner will display the note name (e.g., E, A, D).</li>
          <li><strong>Adjust Pitch:</strong> 
            <ul>
              <li>If the needle is to the <strong>left</strong>, your string is too loose (Flat). Tighten it.</li>
              <li>If the needle is to the <strong>right</strong>, your string is too tight (Sharp). Loosen it.</li>
            </ul>
          </li>
          <li><strong>Lock It In:</strong> When the note turns green and the diamond centers, you are perfectly in tune.</li>
        </ol>
      </section>

      <section className="seo-section">
        <h2>Standard Guitar Tuning Frequencies (Hz)</h2>
        <p>
          Standard tuning (EADGBE) is the most common tuning for a 6-string guitar. 
          Here are the exact frequencies for reference:
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
            <tr><td>1 (Thinnest)</td><td>E4</td><td>329.63 Hz</td></tr>
            <tr><td>2</td><td>B3</td><td>246.94 Hz</td></tr>
            <tr><td>3</td><td>G3</td><td>196.00 Hz</td></tr>
            <tr><td>4</td><td>D3</td><td>146.83 Hz</td></tr>
            <tr><td>5</td><td>A2</td><td>110.00 Hz</td></tr>
            <tr><td>6 (Thickest)</td><td>E2</td><td>82.41 Hz</td></tr>
          </tbody>
        </table>
      </section>

      <section className="seo-section">
        <h2>Why Use This Microphone Tuner?</h2>
        <p>
          Unlike clip-on tuners that can run out of batteries, this <strong>web-based tuner</strong> 
          is always available in your pocket. It uses high-fidelity algorithms (YIN pitch detection) 
          typically found in expensive pedal tuners to filter out background noise and lock onto 
          your fundamental frequency instantly. Perfect for beginners and professionals alike.
        </p>
      </section>
    </article>
  );
};
