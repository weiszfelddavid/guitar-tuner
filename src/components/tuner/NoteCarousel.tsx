import React from 'react';
import { type TunerStatus } from './NoteDisplay';

interface NoteCarouselProps {
  note: string;
  status: TunerStatus;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const NoteCarousel: React.FC<NoteCarouselProps> = ({ note, status }) => {
  const isVisible = status !== 'idle';
  
  // Find current note index
  const noteName = note.replace(/[0-9]/g, '');
  const currentIndex = NOTES.indexOf(noteName);
  
  return (
    <div className={`note-carousel-container ${isVisible ? 'visible' : ''}`}>
      <div className="carousel-ruler">
        <div className="ruler-ticks">
          {Array.from({ length: 41 }).map((_, i) => (
            <div key={i} className={`ruler-tick ${i % 5 === 0 ? 'major' : 'minor'}`} />
          ))}
        </div>
        <div className="notes-wrapper" style={{ transform: `translateX(${-currentIndex * 60}px)` }}>
          {NOTES.map((n, i) => (
            <div key={`${n}-${i}`} className={`carousel-note ${n === noteName ? 'active' : ''}`}>
              {n}
            </div>
          ))}
        </div>
      </div>
      <div className="focus-box">
        <div className="focus-arrow-up" />
        <div className="focus-arrow-down" />
      </div>
    </div>
  );
};
