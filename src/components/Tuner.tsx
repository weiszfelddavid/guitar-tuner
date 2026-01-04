import React, { useEffect, useState } from 'react';
import '../App.css';
import { type Tuning, TUNINGS } from '../utils/tunings';
import { useTranslation } from '../hooks/useTranslation';
import { useAudioTuner } from '../hooks/useAudioTuner';

// Sub-components
import { TuningSelector } from './tuner/TuningSelector';
import { StringVisualizer } from './tuner/StringVisualizer';
import { AnalogMeter } from './tuner/AnalogMeter';
import { NoteCarousel } from './tuner/NoteCarousel';
import { Sparkline } from './tuner/Sparkline';
import { SoundLevelIndicator } from './tuner/SoundLevelIndicator';

export const Tuner: React.FC<{ 
  initialTuning?: Tuning
}> = ({ initialTuning }) => {
  const { t } = useTranslation();
  const [selectedTuning, setSelectedTuning] = useState<Tuning>(initialTuning || TUNINGS[0]);
  
  const {
    tunerStatus,
    isPaused,
    pitch,
    noteData,
    centsHistory,
    volume,
    micError,
    startTuner
  } = useAudioTuner(selectedTuning.instrument);

  useEffect(() => {
    if (initialTuning) {
      setSelectedTuning(initialTuning);
    }
  }, [initialTuning]);

  const handleStart = () => {
    startTuner();
  };

  return (
    <div className="tuner-wrapper">
      <TuningSelector 
        selected={selectedTuning} 
        onActivate={handleStart}
      />

      <div className="tuner-main-display">
        {micError && (
          <div className="start-overlay" onClick={handleStart}>
            <div className="start-message">
              <div>{t('common.mic_denied')}</div>
              <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '0.5rem' }}>{t('common.tap_to_retry')}</div>
            </div>
          </div>
        )}

        {tunerStatus === 'idle' && !isPaused && !micError && (
          <div className="start-overlay" onClick={handleStart}>
            <div className="start-message">{t('common.tap_to_enable')}</div>
          </div>
        )}

        {isPaused && (
          <div className="start-overlay" onClick={handleStart}>
            <div className="start-message">
              <div>{t('common.tuner_paused')}</div>
              <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '0.5rem' }}>{t('common.tap_to_resume')}</div>
            </div>
          </div>
        )}

        <Sparkline history={centsHistory} />
        
        <AnalogMeter 
          cents={noteData.cents}
          status={tunerStatus}
        />
        
        <NoteCarousel 
          note={noteData.note}
          status={tunerStatus}
        />

        <StringVisualizer 
          tuning={selectedTuning} 
          pitch={pitch} 
        />

        <SoundLevelIndicator volume={volume} />
      </div>
      
      <div className="tech-readout">
        {tunerStatus === 'idle' ? t('common.ready') : (tunerStatus === 'holding' ? t('common.hold') : (pitch ? `${pitch.toFixed(1)} Hz` : t('common.listening')))}
      </div>
    </div>
  );
};
