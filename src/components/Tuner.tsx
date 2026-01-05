import React from 'react';
import '../App.css';
import { type Tuning } from '../utils/tunings';
import { useTranslation } from '../hooks/useTranslation';
import { useAudioTuner } from '../hooks/useAudioTuner';

// Sub-components
import { TuningSelector } from './tuner/TuningSelector';
import { StringVisualizer } from './tuner/StringVisualizer';
import { AnalogMeter } from './tuner/AnalogMeter';
import { NoteDisplay } from './tuner/NoteDisplay';
import { Sparkline } from './tuner/Sparkline';
import { SoundLevelIndicator } from './tuner/SoundLevelIndicator';
import { WaveformScope } from './tuner/WaveformScope'; // Import Scope
import { noteToFreq } from '../utils/tunings';

export const Tuner: React.FC<{ 
  tuning: Tuning
}> = ({ tuning }) => {
  const { t } = useTranslation();
  
  const {
    tunerStatus,
    isPaused,
    pitch,
    noteData,
    centsHistory,
    volume,
    waveform, // Get waveform data
    micError,
    startTuner
  } = useAudioTuner(tuning.instrument);

  // Calculate target note from the predefined tuning
  const targetNote = React.useMemo(() => {
    if (!pitch || tuning.instrument === 'voice') return undefined;
    
    let closestNote = "";
    let minDiff = Infinity;
    
    tuning.notes.forEach(note => {
      const freq = noteToFreq(note);
      const diff = Math.abs(Math.log2(pitch / freq));
      if (diff < minDiff) {
        minDiff = diff;
        closestNote = note.replace(/[0-9]/g, '');
      }
    });
    
    return closestNote;
  }, [pitch, tuning]);

  const handleStart = () => {
    startTuner();
  };

  return (
    <div className="tuner-wrapper">
      <TuningSelector 
        selected={tuning} 
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

        {/* Oscilloscope Background Layer */}
        <WaveformScope 
            waveform={waveform} 
            active={tunerStatus !== 'idle'} 
            resetKey={`${tuning.instrument}-${tuning.slug}`}
        />

        <Sparkline history={centsHistory} />
        
        <AnalogMeter 
          cents={noteData.cents}
          status={tunerStatus}
        />
        
        <NoteDisplay 
          note={noteData.note}
          status={tunerStatus}
          cents={noteData.cents}
          targetNote={targetNote}
        />

        <StringVisualizer 
          tuning={tuning} 
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
