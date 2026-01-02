import React, { useState, useRef, useEffect } from 'react';
import '../App.css';
import processorUrl from '../audio/engine/processor?worker&url';
import { getNoteFromPitch, type NoteData } from '../utils/tuner';
import { TUNINGS, noteToFreq, type Tuning } from '../utils/tunings';
import { useTranslation } from '../hooks/useTranslation';

// --- Types ---
interface TunerUpdate {
  pitch: number;
  clarity: number;
  bufferrms: number;
}

type TunerStatus = 'idle' | 'listening' | 'detecting' | 'locked' | 'holding';

// --- Sub-Components ---

const TuningSelector: React.FC<{ 
  selected: Tuning; 
  onSelect: (t: Tuning) => void 
}> = ({ selected, onSelect }) => {
  const { t } = useTranslation();
  return (
    <div className="tuning-selector">
      {TUNINGS.map(tData => (
        <button 
          key={`${tData.instrument}-${tData.slug}`}
          className={`tuning-chip ${selected.slug === tData.slug && selected.instrument === tData.instrument ? 'active' : ''}`}
          onClick={() => onSelect(tData)}
        >
          {t(`tunings.${tData.instrument}_${tData.slug}.name`, tData.name)}
        </button>
      ))}
    </div>
  );
};

const StringVisualizer: React.FC<{ 
  tuning: Tuning; 
  pitch: number | null;
}> = ({ tuning, pitch }) => {
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
    if (minDiff > 0.2) closestIndex = -1; 
  }

  return (
    <div className="string-visualizer">
      {tuning.notes.map((note, i) => (
        <div 
          key={`${tuning.name}-${note}-${i}`} 
          className={`string-node ${closestIndex === i ? 'active' : ''}`}
        >
          <span className="string-label">{note.replace(/[0-9]/g, '')}</span>
          <span className="octave-label">{note.match(/[0-9]/g)}</span>
        </div>
      ))}
    </div>
  );
};

const NoteDisplay: React.FC<{ note: string; status: TunerStatus; cents: number }> = ({ note, status, cents }) => {
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

const RulerGauge: React.FC<{ cents: number; status: TunerStatus }> = ({ cents, status }) => {
  const { t } = useTranslation();
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const percent = ((clampedCents + 50) / 100) * 100;
  const isVisible = status === 'detecting' || status === 'locked' || status === 'holding';
  const isHolding = status === 'holding';

  return (
    <div className={`gauge-container ${isVisible ? 'visible' : ''} ${isHolding ? 'holding' : ''}`}>
      <div className="gauge-ruler">
        <div className="tick major" style={{ left: '0%' }}></div>
        <div className="tick minor" style={{ left: '25%' }}></div>
        <div className="tick center" style={{ left: '50%' }}></div>
        <div className="tick minor" style={{ left: '75%' }}></div>
        <div className="tick major" style={{ left: '100%' }}></div>
      </div>
      <div className="gauge-indicator" style={{ left: `${percent}%` }}></div>
      <div className="cents-label">
        {isVisible ? `${cents > 0 ? '+' : ''}${Math.round(cents)} ${t('common.cents_label')}` : ''}
      </div>
    </div>
  );
};

const Sparkline: React.FC<{ history: number[] }> = ({ history }) => {
  if (history.length < 2) return null;
  const width = 300;
  const height = 100;
  const normalizeY = (cents: number) => {
    const clamped = Math.max(-50, Math.min(50, cents));
    return height - ((clamped + 50) / 100 * height);
  };

  const getPath = (data: number[]) => {
    if (data.length === 0) return "";
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = normalizeY(val);
      return [x, y];
    });

    return points.reduce((acc, [x, y], i, arr) => {
      if (i === 0) return `M ${x},${y}`;
      const [prevX, prevY] = arr[i - 1];
      const cp1x = prevX + (x - prevX) / 2;
      const cp1y = prevY;
      const cp2x = prevX + (x - prevX) / 2;
      const cp2y = y;
      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
    }, "");
  };

  return (
    <div className="sparkline-container">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
        <path d={getPath(history)} fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// --- Main Tuner Component ---

export const Tuner: React.FC<{ 
  initialTuning?: Tuning,
  onTuningChange?: (t: Tuning) => void 
}> = ({ initialTuning, onTuningChange }) => {
  const { t } = useTranslation();
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteData, setNoteData] = useState<NoteData>({ note: '--', cents: 0 });
  const [centsHistory, setCentsHistory] = useState<number[]>(new Array(100).fill(0));
  const [selectedTuning, setSelectedTuning] = useState<Tuning>(initialTuning || TUNINGS[0]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const centsBufferRef = useRef<number[]>([]);
  const lastValidTimeRef = useRef<number>(0);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTuner = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setTunerStatus('idle');
    setPitch(null);
  };

  const startTuner = async () => {
    if (audioContextRef.current) return;

    try {
      setIsPaused(false);
      setTunerStatus('listening');
      const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextConstructor();
      await audioContext.audioWorklet.addModule(processorUrl);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = audioContext.createMediaStreamSource(stream);
      const pitchProcessor = new AudioWorkletNode(audioContext, 'pitch-processor');

      const SILENCE_THRESHOLD = 0.01; 
      const CLARITY_THRESHOLD = 0.90; 
      const LOCK_TOLERANCE_CENTS = 4;
      const HOLD_TIME_MS = 1500;
      const SMOOTHING_WINDOW = 4;

      pitchProcessor.port.onmessage = (event) => {
        const { pitch, clarity, bufferrms } = event.data as TunerUpdate;
        const now = Date.now();
        
        if (bufferrms < SILENCE_THRESHOLD) {
          if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < HOLD_TIME_MS) {
            setTunerStatus('holding');
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = setTimeout(() => {
              setTunerStatus('listening');
              setPitch(null);
            }, HOLD_TIME_MS - (now - lastValidTimeRef.current));
          } else if (now - lastValidTimeRef.current >= HOLD_TIME_MS) {
            setTunerStatus('listening');
            setPitch(null);
          }
          return;
        }

        if (pitch && clarity > 0.8) {
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
          lastValidTimeRef.current = now;
          setPitch(pitch);
          const rawData = getNoteFromPitch(pitch);
          const buffer = centsBufferRef.current;
          buffer.push(rawData.cents);
          if (buffer.length > SMOOTHING_WINDOW) buffer.shift();
          const smoothedCents = buffer.reduce((a, b) => a + b, 0) / buffer.length;
          
          setNoteData({ note: rawData.note, cents: smoothedCents });
          setCentsHistory(prev => {
            const newHistory = [...prev, smoothedCents];
            return newHistory.slice(Math.max(newHistory.length - 100, 0));
          });

          if (clarity > CLARITY_THRESHOLD && Math.abs(smoothedCents) < LOCK_TOLERANCE_CENTS) {
            setTunerStatus('locked');
          } else {
            setTunerStatus('detecting');
          }
        } else {
           if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < HOLD_TIME_MS) {
             setTunerStatus('holding');
           } else {
             setTunerStatus('listening');
           }
        }
      };

      source.connect(pitchProcessor);
      pitchProcessor.connect(audioContext.destination);
      audioContextRef.current = audioContext;

    } catch (error) {
      console.error('Error starting tuner:', error);
      setTunerStatus('idle');
      alert(t('common.mic_required'));
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Hard Stop: Release hardware immediately
        if (audioContextRef.current) {
          stopTuner();
          setIsPaused(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const checkPermissions = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (result.state === 'granted') {
            startTuner();
          }
        }
      } catch (e) {
        console.debug('Permission check failed', e);
      }
    };
    checkPermissions();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTuner();
    };
  }, []);

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

      <Sparkline history={centsHistory} />
      
      <div className="center-stack">
        <NoteDisplay 
          note={noteData.note} 
          status={tunerStatus}
          cents={noteData.cents}
        />
        
        <StringVisualizer 
          tuning={selectedTuning} 
          pitch={pitch} 
        />
      </div>
      
      <RulerGauge 
        cents={noteData.cents} 
        status={tunerStatus} 
      />
      
      <div className="tech-readout">
        {tunerStatus === 'idle' ? t('common.ready') : (tunerStatus === 'holding' ? t('common.hold') : (pitch ? `${pitch.toFixed(1)} Hz` : t('common.listening')))}
      </div>
    </div>
  );
};