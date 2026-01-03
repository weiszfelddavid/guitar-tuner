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
  // Flat (Left): Negative cents. Brightness increases as we get further from 0, but maxes out near -50
  // Sharp (Right): Positive cents.
  // Success: Both light up green.
  
  // Opacity Logic:
  // If locked: Both arrows active (green).
  // If not locked:
  //   Left Arrow: Active if cents < -3. Opacity based on magnitude.
  //   Right Arrow: Active if cents > 3. Opacity based on magnitude.
  
  const tolerance = 3;
  const isFlat = cents < -tolerance;
  const isSharp = cents > tolerance;
  
  // Dynamic color classes
  const leftClass = isLocked 
    ? 'arrow arrow-left success pulsing' 
    : `arrow arrow-left ${isFlat ? 'active flat' : 'inactive'}`;
    
  const rightClass = isLocked 
    ? 'arrow arrow-right success pulsing' 
    : `arrow arrow-right ${isSharp ? 'active sharp' : 'inactive'}`;

  // Center Dot (optional, keeps anchor)
  const centerClass = isLocked ? 'center-dot success' : 'center-dot';

  if (!isVisible) return <div className="accuracy-arrows-placeholder" />;

  return (
    <div className="accuracy-arrows-container">
      <div className={leftClass}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </div>
      
      <div className={centerClass} />
      
      <div className={rightClass}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </div>
    </div>
  );
};
