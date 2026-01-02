import { useState, useRef, useEffect } from 'react';
import './App.css';
import processorUrl from './audio/engine/processor?worker&url';
import { getNoteFromPitch, type NoteData } from './utils/tuner';
import { TUNINGS, noteToFreq, type Tuning } from './utils/tunings';
import { APP_VERSION } from './version';

// --- Types ---
interface TunerUpdate {
  pitch: number;
  clarity: number;
  bufferrms: number;
}

type TunerStatus = 'idle' | 'listening' | 'detecting' | 'locked' | 'holding';

// --- Components ---

const TuningSelector: React.FC<{ 
  selected: Tuning; 
  onSelect: (t: Tuning) => void 
}> = ({ selected, onSelect }) => {
  return (
    <div className="tuning-selector">
      {TUNINGS.map(t => (
        <button 
          key={t.name}
          className={`tuning-chip ${selected.name === t.name ? 'active' : ''}`}
          onClick={() => onSelect(t)}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
};

const StringVisualizer: React.FC<{ 
  tuning: Tuning; 
  pitch: number | null;
}> = ({ tuning, pitch }) => {
  // Find the closest string in the tuning to the current pitch
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
    // Only highlight if we are somewhat close (within 3 semitones)
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
  
  // Calculate dynamic glow intensity based on how close to 0 cents we are
  // 0 cents = max glow, 50 cents = 0 glow
  const absCents = Math.abs(cents);
  const glowIntensity = Math.max(0, 1 - (absCents / 20)); // Glows when within 20 cents
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
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const percent = ((clampedCents + 50) / 100) * 100;
  
  const isVisible = status === 'detecting' || status === 'locked' || status === 'holding';
  const isHolding = status === 'holding';

  return (
    <div className={`gauge-container ${isVisible ? 'visible' : ''} ${isHolding ? 'holding' : ''}`}>
      <div className="gauge-ruler">
        {/* Ticks */}
        <div className="tick major" style={{ left: '0%' }}></div>   {/* -50 */}
        <div className="tick minor" style={{ left: '25%' }}></div>  {/* -25 */}
        <div className="tick center" style={{ left: '50%' }}></div> {/* 0 */}
        <div className="tick minor" style={{ left: '75%' }}></div>  {/* +25 */}
        <div className="tick major" style={{ left: '100%' }}></div> {/* +50 */}
      </div>
      
      <div 
        className="gauge-indicator" 
        style={{ left: `${percent}%` }}
      ></div>
      
      <div className="cents-label">
        {isVisible ? `${cents > 0 ? '+' : ''}${Math.round(cents)} ct` : ''}
      </div>
    </div>
  );
};

const Sparkline: React.FC<{ history: number[] }> = ({ history }) => {
  if (history.length < 2) return null;

  // SVG Dimensions
  const width = 300;
  const height = 100;
  
  // Map cents (-50 to +50) to Y (height to 0)
  const normalizeY = (cents: number) => {
    const clamped = Math.max(-50, Math.min(50, cents));
    return height - ((clamped + 50) / 100 * height);
  };

  // Generate smooth Bezier path
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
      
      // Simple smoothing: Control point is halfway between X's, but same Y as previous/current? 
      // Better: Cubic Bezier with control points based on slope.
      // For simplicity and "sparkline" look, a simple cubic spline works well.
      // Here we'll use a simplified strategy: Control points at mid-x, preserving y flatness?
      // No, let's use a standard smoothing technique.
      
      // Strategy: Control point 1 is (prevX + (x-prevX)/2, prevY)
      // Strategy: Control point 2 is (prevX + (x-prevX)/2, y)
      // This creates an "S" curve between points.
      
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
        {/* Center line */}
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
        
        <path
          d={getPath(history)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// --- Main App ---

function App() {
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteData, setNoteData] = useState<NoteData>({ note: '--', cents: 0 });
  const [centsHistory, setCentsHistory] = useState<number[]>(new Array(100).fill(0));
  const [selectedTuning, setSelectedTuning] = useState<Tuning>(TUNINGS[0]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const centsBufferRef = useRef<number[]>([]);
  const lastValidTimeRef = useRef<number>(0);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTuner = async () => {
    if (audioContextRef.current) return;

    try {
      setTunerStatus('listening');

      const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextConstructor();

      await audioContext.audioWorklet.addModule(processorUrl);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.createMediaStreamSource(stream);
      const pitchProcessor = new AudioWorkletNode(audioContext, 'pitch-processor');

      // Constants
      const SILENCE_THRESHOLD = 0.01; 
      const CLARITY_THRESHOLD = 0.90; 
      const LOCK_TOLERANCE_CENTS = 4;
      const HOLD_TIME_MS = 1500;
      const SMOOTHING_WINDOW = 4;

      pitchProcessor.port.onmessage = (event) => {
        const { pitch, clarity, bufferrms } = event.data as TunerUpdate;
        const now = Date.now();
        
        // 1. Silence Gate
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

        // 2. Pitch Detection
        if (pitch && clarity > 0.8) {
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
          
          lastValidTimeRef.current = now;
          setPitch(pitch);
          
          const rawData = getNoteFromPitch(pitch);
          
          // Apply Smoothing
          const buffer = centsBufferRef.current;
          buffer.push(rawData.cents);
          if (buffer.length > SMOOTHING_WINDOW) buffer.shift();
          const smoothedCents = buffer.reduce((a, b) => a + b, 0) / buffer.length;
          
          setNoteData({
            note: rawData.note,
            cents: smoothedCents
          });

          // Update Sparkline History (keep last 100 points)
          setCentsHistory(prev => {
            const newHistory = [...prev, smoothedCents];
            return newHistory.slice(Math.max(newHistory.length - 100, 0));
          });

          // 3. Status Logic
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
      {tunerStatus === 'idle' && (
        <div className="start-overlay" onClick={startTuner}>
          <div className="start-message">Tap to Enable Tuner</div>
        </div>
      )}

      <main className="tuner-interface">
        <TuningSelector 
          selected={selectedTuning} 
          onSelect={setSelectedTuning} 
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
          {tunerStatus === 'idle' ? 'Ready' : (tunerStatus === 'holding' ? 'Hold' : (pitch ? `${pitch.toFixed(1)} Hz` : 'Listening...'))}
        </div>
        
        <div className="version-footer">
          {APP_VERSION}
        </div>
      </main>
    </div>
  );
}

export default App;