import React from 'react';

export type TunerStatus = 'idle' | 'listening' | 'detecting' | 'locked' | 'holding';

interface NoteDisplayProps { 
  note: string; 
  status: TunerStatus; 
  cents: number; 
}

export const NoteDisplay: React.FC<NoteDisplayProps> = ({ note, status, cents }) => {
  const isLocked = status === 'locked';
  const isHolding = status === 'holding';
  const absCents = Math.abs(cents);
  const glowIntensity = Math.max(0, 1 - (absCents / 20));
  const glowStyle = isLocked 
    ? { textShadow: `0 0 40px rgba(0, 230, 118, 0.8)` } 
    : { textShadow: `0 0 ${glowIntensity * 20}px rgba(255, 255, 255, ${glowIntensity * 0.5})` };

  return (
    <div 
      className={`note-display ${isLocked ? 'locked' : ''} ${isHolding ? 'holding' : ''}`}
      style={status !== 'idle' ? glowStyle : {}}
    >
      {status === 'listening' ? '--' : note}
    </div>
  );
};
