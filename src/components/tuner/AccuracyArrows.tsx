import React from 'react';
import { type TunerStatus } from './NoteDisplay';

interface AccuracyArrowsProps { 
  cents: number; 
  status: TunerStatus; 
}

export const AccuracyArrows: React.FC<AccuracyArrowsProps> = ({ cents, status }) => {
  const isLocked = status === 'locked';
  const isVisible = status === 'detecting' || status === 'locked' || status === 'holding';
  
  // Calculate accuracy indicators
  // Flat (Left): Negative cents. Brightness increases as we get further from 0.
  // Sharp (Right): Positive cents. Brightness increases as we get further from 0.
  
  // We want a subtle transition. 
  // Max brightness at +/- 50 cents.
  // Min brightness at 0 cents (if not locked).
  
  const absCents = Math.abs(cents);
  const intensity = Math.min(1, Math.max(0.2, absCents / 50)); // Clamp between 0.2 and 1.0

  const isFlat = cents < 0;
  const isSharp = cents > 0;

  // Dynamic styles for opacity
  const leftStyle = isLocked 
    ? { opacity: 1 } 
    : { opacity: isFlat ? intensity : 0.2 };

  const rightStyle = isLocked 
    ? { opacity: 1 } 
    : { opacity: isSharp ? intensity : 0.2 };

  const leftClass = isLocked 
    ? 'arrow arrow-left success pulsing' 
    : `arrow arrow-left ${isFlat ? 'flat' : ''}`;
    
  const rightClass = isLocked 
    ? 'arrow arrow-right success pulsing' 
    : `arrow arrow-right ${isSharp ? 'sharp' : ''}`;

  const centerClass = isLocked ? 'center-dot success' : 'center-dot';

  if (!isVisible) return <div className="accuracy-arrows-placeholder" />;

  return (
    <div className="accuracy-arrows-container">
      <div className={leftClass} style={leftStyle}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </div>
      
      <div className={centerClass} />
      
      <div className={rightClass} style={rightStyle}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </div>
    </div>
  );
};
