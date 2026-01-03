import React from 'react';

interface SoundLevelIndicatorProps {
  volume: number; // RMS value, typically 0.0 to 1.0 (though usually much smaller like 0.01 - 0.2)
}

export const SoundLevelIndicator: React.FC<SoundLevelIndicatorProps> = ({ volume }) => {
  // Detection threshold is 0.01.
  // Normalize volume for display.
  // RMS is often very small. 0.01 is silence threshold.
  // Let's amplify it for visualization.
  // Max expected might be 0.3 or 0.5.
  
  const displayVolume = Math.min(1, volume * 5); // Scale up for visibility
  const isActive = volume > 0.01;
  
  const style: React.CSSProperties = {
    position: 'absolute',
    bottom: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    width: `${displayVolume * 100}%`,
    maxWidth: '80%',
    height: '2px',
    backgroundColor: isActive ? 'var(--accent-flat)' : '#444',
    opacity: isActive ? 0.6 : 0.2,
    transition: 'width 0.1s ease, background-color 0.2s ease',
    borderRadius: '1px',
    pointerEvents: 'none',
  };

  return <div className="sound-level-indicator" style={style} />;
};
