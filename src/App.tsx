import { useState, useRef, useEffect } from 'react';
import './App.css';
import processorUrl from './audio/engine/processor?worker&url';
import { getNoteFromPitch, type NoteData } from './utils/tuner';

// --- Types ---
interface TunerUpdate {
  pitch: number;
  clarity: number;
  bufferrms: number;
}

type TunerStatus = 'idle' | 'listening' | 'detecting' | 'locked';

// --- Components ---

const NoteDisplay: React.FC<{ note: string; status: TunerStatus }> = ({ note, status }) => {
  const isLocked = status === 'locked';
  return (
    <div className={`note-display ${isLocked ? 'locked' : ''}`}>
      {note || "--"}
    </div>
  );
};

const CentsGauge: React.FC<{ cents: number; status: TunerStatus }> = ({ cents, status }) => {
  // Clamp cents between -50 and 50 for display
  const clampedCents = Math.max(-50, Math.min(50, cents));
  // Convert -50..50 to 0..100% for CSS placement
  const percent = ((clampedCents + 50) / 100) * 100;
  
  const isVisible = status === 'detecting' || status === 'locked';

  return (
    <div className={`gauge-container ${isVisible ? 'visible' : ''}`}>
      <div className="gauge-track">
        <div className="center-marker"></div>
      </div>
      <div 
        className="gauge-indicator" 
        style={{ left: `${percent}%` }}
      ></div>
      <div className="cents-label">{isVisible ? `${Math.round(cents)} ct` : ''}</div>
    </div>
  );
};

// --- Main App ---

function App() {
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteData, setNoteData] = useState<NoteData>({ note: '--', cents: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);

  const startTuner = async () => {
    if (audioContextRef.current) return;

    try {
      setTunerStatus('listening');

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule(processorUrl);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.createMediaStreamSource(stream);
      const pitchProcessor = new AudioWorkletNode(audioContext, 'pitch-processor');

      // Constants for FSM
      const SILENCE_THRESHOLD = 0.01; 
      const CLARITY_THRESHOLD = 0.90; // High confidence for lock
      const LOCK_TOLERANCE_CENTS = 5;

      pitchProcessor.port.onmessage = (event) => {
        const { pitch, clarity, bufferrms } = event.data as TunerUpdate;
        
        // 1. Silence Gate
        if (bufferrms < SILENCE_THRESHOLD) {
          setTunerStatus('listening');
          setPitch(null);
          return;
        }

        // 2. Pitch Detection
        if (pitch && clarity > 0.8) {
          setPitch(pitch);
          const data = getNoteFromPitch(pitch);
          setNoteData(data);

          // 3. Status Logic
          if (clarity > CLARITY_THRESHOLD && Math.abs(data.cents) < LOCK_TOLERANCE_CENTS) {
            setTunerStatus('locked');
          } else {
            setTunerStatus('detecting');
          }
        } else {
          // Noisy signal but loud enough to not be silence
          setTunerStatus('listening');
        }
      };

      source.connect(pitchProcessor);
      pitchProcessor.connect(audioContext.destination);

    } catch (error) {
      console.error('Error starting tuner:', error);
      setTunerStatus('idle');
      alert('Microphone access is required to use the tuner.');
    }
  };

  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className={`App ${tunerStatus}`}>
      
      {tunerStatus === 'idle' ? (
        <div className="start-screen">
          <h1>Guitar Tuner</h1>
          <button className="start-btn" onClick={startTuner}>
            Start Tuner
          </button>
        </div>
      ) : (
        <main className="tuner-interface">
          <NoteDisplay 
            note={tunerStatus === 'listening' ? '--' : noteData.note} 
            status={tunerStatus} 
          />
          
          <CentsGauge 
            cents={tunerStatus === 'listening' ? 0 : noteData.cents} 
            status={tunerStatus} 
          />
          
          <div className="tech-readout">
            {pitch ? `${pitch.toFixed(1)} Hz` : 'Listening...'}
          </div>
        </main>
      )}
    </div>
  );
}

export default App;