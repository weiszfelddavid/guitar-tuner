import React from 'react';
import { noteToFreq, type Tuning } from '../../utils/tunings';
import { getNoteDetails } from '../../utils/tuner';

export const StringVisualizer: React.FC<{ 
  tuning: Tuning; 
  pitch: number | null;
}> = ({ tuning, pitch }) => {
  if (tuning.instrument === 'voice') {
    const details = pitch ? getNoteDetails(pitch) : { note: '-', octave: '-' };
    return (
      <div className="string-nav-bar">
        <div className={`string-bubble active`} style={{ width: 'auto', padding: '0 1.5rem', borderRadius: '30px' }}>
          <span className="note-label">{details.note}</span>
          <span className="octave-sub" style={{ fontSize: '1rem', marginLeft: '4px' }}>{details.octave}</span>
        </div>
      </div>
    );
  }

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
    // Loosen tolerance for visual feedback (0.3 octaves ~ 4 semitones)
    if (minDiff > 0.3) closestIndex = -1; 
  }

  return (
    <div className="string-nav-bar">
      {tuning.notes.map((note, i) => (
        <div 
          key={`${tuning.name}-${note}-${i}`} 
          className={`string-bubble ${closestIndex === i ? 'active' : ''}`}
        >
          <span className="note-label">{note.replace(/[0-9]/g, '')}</span>
          <span className="octave-sub">{note.match(/[0-9]/g)}</span>
        </div>
      ))}
    </div>
  );
};