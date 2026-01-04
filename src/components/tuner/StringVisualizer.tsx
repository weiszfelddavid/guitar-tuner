import React from 'react';
import { noteToFreq, type Tuning } from '../../utils/tunings';
import { getNoteDetails } from '../../utils/tuner';

export const StringVisualizer: React.FC<{ 
  tuning: Tuning; 
  pitch: number | null;
}> = ({ tuning, pitch }) => {
  if (tuning.instrument === 'voice') {
    const details = pitch ? getNoteDetails(pitch) : { note: '-', octave: '-' };
    // For voice, keep a simple display but style it to match the new aesthetic if possible, 
    // or just a single line that glows. Let's keep it simple for now.
    return (
      <div className="string-visualizer" style={{ alignItems: 'center', gap: 0 }}>
        <div className="string-line-container active" style={{ justifyContent: 'center' }}>
           <div className="string-line" style={{ height: '4px', width: '100%' }}></div>
           <span style={{ position: 'absolute', color: '#fff', fontWeight: 'bold' }}>
             {details.note}{details.octave}
           </span>
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
    // Loosen tolerance for visual feedback
    if (minDiff > 0.3) closestIndex = -1; 
  }

  // Calculate thickness: 
  // Assuming notes are ordered low to high. 
  // We want the first note (Low E) to be thickest.
  // Max thickness ~4px, Min ~1px.
  const getThickness = (index: number, total: number) => {
    // Map 0 -> Max, Total-1 -> Min
    if (total <= 1) return 3;
    const max = 5;
    const min = 1.5;
    const step = (max - min) / (total - 1);
    return max - (index * step);
  };

  return (
    <div className="string-visualizer">
      {tuning.notes.map((note, i) => (
        <div 
          key={`${tuning.name}-${note}-${i}`} 
          className={`string-line-container ${closestIndex === i ? 'active' : ''}`}
        >
          <div className="string-label-floating">
            {note.replace(/[0-9]/g, '')}
          </div>
          <div 
            className="string-line" 
            style={{ height: `${getThickness(i, tuning.notes.length)}px` }}
          />
        </div>
      ))}
    </div>
  );
};