import React, { useEffect, useState } from 'react';
import '../App.css';
import { type Tuning, TUNINGS } from '../utils/tunings';
import { useTranslation } from '../hooks/useTranslation';
import { useAudioTuner } from '../hooks/useAudioTuner';

// Sub-components
import { TuningSelector } from './tuner/TuningSelector';
import { StringVisualizer } from './tuner/StringVisualizer';
import { NoteDisplay } from './tuner/NoteDisplay';
import { AccuracyArrows } from './tuner/AccuracyArrows';
import { Sparkline } from './tuner/Sparkline';

export const Tuner: React.FC<{ 
  initialTuning?: Tuning,
  onTuningChange?: (t: Tuning) => void
}> = ({ initialTuning, onTuningChange }) => {
  const { t } = useTranslation();
  const [selectedTuning, setSelectedTuning] = useState<Tuning>(initialTuning || TUNINGS[0]);
  
  const {
    tunerStatus,
    isPaused,
    pitch,
    noteData,
    centsHistory,
    startTuner
  } = useAudioTuner(t);

  useEffect(() => {
    if (initialTuning) {
      setSelectedTuning(initialTuning);
    }
  }, [initialTuning]);

  const handleTuningSelect = (tData: Tuning) => {
    setSelectedTuning(tData);
    onTuningChange?.(tData);
  };

  return (
    <div className="tuner-wrapper">
      {tunerStatus === 'idle' && !isPaused && (
        <div className="start-overlay" onClick={startTuner}>
          <div className="start-message">{t('common.tap_to_enable')}</div>
        </div>
      )}

      {isPaused && (
        <div className="start-overlay" onClick={startTuner}>
          <div className="start-message">
            <div>Tuner Paused</div>
            <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '0.5rem' }}>Tap to Resume</div>
          </div>
        </div>
      )}

      <TuningSelector 
        selected={selectedTuning} 
        onSelect={handleTuningSelect} 
      />

      <div className="tuner-main-display">
        <Sparkline history={centsHistory} />
        
        <NoteDisplay 
          note={noteData.note} 
          status={tunerStatus}
          cents={noteData.cents}
        />
        
        <AccuracyArrows 
          cents={noteData.cents} 
          status={tunerStatus} 
        />

        <StringVisualizer 
          tuning={selectedTuning} 
          pitch={pitch} 
        />
      </div>
      
      <div className="tech-readout">
        {tunerStatus === 'idle' ? t('common.ready') : (tunerStatus === 'holding' ? t('common.hold') : (pitch ? `${pitch.toFixed(1)} Hz` : t('common.listening')))}
      </div>
    </div>
  );
};
