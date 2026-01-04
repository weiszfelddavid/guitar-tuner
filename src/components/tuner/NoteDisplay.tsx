import React from 'react';

export type TunerStatus = 'idle' | 'listening' | 'detecting' | 'locked' | 'holding';

interface NoteDisplayProps { 
  note: string; 
  status: TunerStatus; 
  cents: number; 
  targetNote?: string;
}

export const NoteDisplay: React.FC<NoteDisplayProps> = ({ note, status, cents, targetNote }) => {
  const isLocked = status === 'locked';
  const isHolding = status === 'holding';
  const isActive = status !== 'idle' && status !== 'listening';
  
  const absCents = Math.abs(cents);
  const glowIntensity = Math.max(0, 1 - (absCents / 20));
  const glowStyle = isLocked 
    ? { textShadow: `0 0 40px rgba(0, 255, 0, 0.8)` } 
    : { textShadow: `0 0 ${glowIntensity * 20}px rgba(255, 255, 255, ${glowIntensity * 0.5})` };

  // Directional guidance
  let guidance = "";
  let guidanceColor = "#ff9100";
  if (isActive) {
    if (cents < -3) {
      guidance = "Tune Up ↑";
    } else if (cents > 3) {
      guidance = "Tune Down ↓";
    } else {
      guidance = "Perfect!";
      guidanceColor = "#00FF00";
    }
  }

  return (
    <div className="note-display-container">
      {isActive && targetNote && targetNote !== note && (
        <div className="target-note-label">
          Target: {targetNote}
        </div>
      )}
      
      <div 
        className={`note-display ${isLocked ? 'locked' : ''} ${isHolding ? 'holding' : ''}`}
        style={status !== 'idle' ? glowStyle : {}}
      >
        {status === 'listening' ? '--' : note}
      </div>

      {isActive && (
        <div className="guidance-label" style={{ color: guidanceColor }}>
          {guidance}
        </div>
      )}
    </div>
  );
};
