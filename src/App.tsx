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

type TunerStatus = 'idle' | 'listening' | 'detecting' | 'locked' | 'holding';

// --- Components ---

const NoteDisplay: React.FC<{ note: string; status: TunerStatus }> = ({ note, status }) => {
  const isLocked = status === 'locked';
  const isHolding = status === 'holding';
  
  return (
    <div className={`note-display ${isLocked ? 'locked' : ''} ${isHolding ? 'holding' : ''}`}>
      {status === 'listening' ? '--' : note}
    </div>
  );
};

const CentsGauge: React.FC<{ cents: number; status: TunerStatus }> = ({ cents, status }) => {
  // Clamp cents between -50 and 50 for display
  const clampedCents = Math.max(-50, Math.min(50, cents));
  // Convert -50..50 to 0..100% for CSS placement
  const percent = ((clampedCents + 50) / 100) * 100;
  
  const isVisible = status === 'detecting' || status === 'locked' || status === 'holding';
  const isHolding = status === 'holding';

  return (
    <div className={`gauge-container ${isVisible ? 'visible' : ''} ${isHolding ? 'holding' : ''}`}>
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
  const centsBufferRef = useRef<number[]>([]);
  const lastValidTimeRef = useRef<number>(0);
  const holdTimeoutRef = useRef<any>(null);

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

      // Constants
      const SILENCE_THRESHOLD = 0.01; 
      const CLARITY_THRESHOLD = 0.90; 
      const LOCK_TOLERANCE_CENTS = 4;
      const HOLD_TIME_MS = 1500;
      const SMOOTHING_WINDOW = 4; // Frames to average

      pitchProcessor.port.onmessage = (event) => {
        const { pitch, clarity, bufferrms } = event.data as TunerUpdate;
        const now = Date.now();
        
        // 1. Silence Gate
        if (bufferrms < SILENCE_THRESHOLD) {
          // If we were detecting/locked recently, enter HOLD state
          if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < HOLD_TIME_MS) {
            setTunerStatus('holding');
            
            // Clear any existing timeout to avoid double-firing
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            
            // Set a timeout to clear the hold if silence continues
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

        // 2. Pitch Detection
        if (pitch && clarity > 0.8) {
          // Valid signal found, clear any hold timeout
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
          
          lastValidTimeRef.current = now;
          setPitch(pitch);
          
          // Calculate raw note data
          const rawData = getNoteFromPitch(pitch);
          
          // Apply Smoothing to Cents
          const buffer = centsBufferRef.current;
          buffer.push(rawData.cents);
          if (buffer.length > SMOOTHING_WINDOW) buffer.shift();
          const smoothedCents = buffer.reduce((a, b) => a + b, 0) / buffer.length;
          
          setNoteData({
            note: rawData.note,
            cents: smoothedCents
          });

          // 3. Status Logic
          if (clarity > CLARITY_THRESHOLD && Math.abs(smoothedCents) < LOCK_TOLERANCE_CENTS) {
            setTunerStatus('locked');
          } else {
            setTunerStatus('detecting');
          }
        } else {
          // Noisy but loud - treat as holding or listening
           if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < HOLD_TIME_MS) {
             setTunerStatus('holding');
           } else {
             setTunerStatus('listening');
           }
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
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
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
            note={noteData.note} 
            status={tunerStatus} 
          />
          
          <CentsGauge 
            cents={noteData.cents} 
            status={tunerStatus} 
          />
          
          <div className="tech-readout">
            {tunerStatus === 'holding' ? 'Hold' : (pitch ? `${pitch.toFixed(1)} Hz` : 'Listening...')}
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
