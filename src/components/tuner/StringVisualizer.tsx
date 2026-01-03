import React from 'react';
import { noteToFreq, type Tuning } from '../../utils/tunings';

export const StringVisualizer: React.FC<{ 
  tuning: Tuning; 
  pitch: number | null;
}> = ({ tuning, pitch }) => {
  let closestIndex = -1;
  if (pitch) {
    let minDiff = Infinity;
    tuning.notes.forEach((note, index) => {
      const targetFreq = noteToFreq(note);
      const diff = Math.abs(Math.log2(pitch / targetFreq));
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });
    if (minDiff > 0.2) closestIndex = -1; 
  }

  return (
    <div className="string-visualizer">
      {tuning.notes.map((note, i) => (
        <div 
          key={`${tuning.name}-${note}-${i}`} 
          className={`string-node ${closestIndex === i ? 'active' : ''}`}
        >
          <span className="string-label">{note.replace(/[0-9]/g, '')}</span>
          <span className="octave-label">{note.match(/[0-9]/g)}</span>
        </div>
      ))}
    </div>
  );
};
