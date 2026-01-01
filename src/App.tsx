import { useState, useRef, useEffect } from 'react';
import './App.css';
import processorUrl from './audio/engine/processor?url';

// Placeholder for TunerInterface - to be implemented later
interface TunerUpdate {
  pitch: number;
  clarity: number;
  bufferrms: number;
}

type TunerStatus = 'idle' | 'listening' | 'detecting' | 'locked';

interface TunerInterfaceProps {
  pitch: number | null;
  clarity: number | null;
  status: TunerStatus;
}

const TunerInterface: React.FC<TunerInterfaceProps> = ({ pitch, clarity, status }) => {
  return (
    <div>
      <h2>Tuner Interface</h2>
      <p>Status: {status}</p>
      <p>Pitch: {pitch ? pitch.toFixed(2) + ' Hz' : 'N/A'}</p>
      <p>Clarity: {clarity ? (clarity * 100).toFixed(1) + '%' : 'N/A'}</p>
      <p>(This is a placeholder component)</p>
    </div>
  );
};

function App() {
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [pitch, setPitch] = useState<number | null>(null);
  const [clarity, setClarity] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  const startTuner = async () => {
    if (audioContextRef.current) {
      // If already started, just return
      return;
    }

    try {
      setTunerStatus('listening');

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule(processorUrl);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.createMediaStreamSource(stream);

      const pitchProcessor = new AudioWorkletNode(audioContext, 'pitch-processor');

      const SILENCE_THRESHOLD = 0.001; // Adjust as needed, based on typical microphone noise floor

      pitchProcessor.port.onmessage = (event) => {
        const tunerUpdate: TunerUpdate = event.data;
        
        if (tunerUpdate.bufferrms < SILENCE_THRESHOLD) {
          setTunerStatus('listening');
          setPitch(null);
          setClarity(null);
        } else if (tunerUpdate.pitch) {
          setPitch(tunerUpdate.pitch);
          setClarity(tunerUpdate.clarity);
          setTunerStatus('locked');
        } else {
          setPitch(null);
          setClarity(null);
          setTunerStatus('detecting');
        }
      };

      source.connect(pitchProcessor);
      pitchProcessor.connect(audioContext.destination);

      // Optional: Add an analyser node for visualization purposes if needed later
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analysernodeRef.current = analyser;

    } catch (error) {
      console.error('Error starting tuner:', error);
      setTunerStatus('idle');
      alert('Error starting tuner. Please ensure microphone access is granted.');
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup audio context on component unmount
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return (
    <div className="App">
      <h1>Guitar Tuner</h1>
      {tunerStatus === 'idle' && (
        <button onClick={startTuner}>Start Tuner</button>
      )}
      <TunerInterface pitch={pitch} clarity={clarity} status={tunerStatus} />
    </div>
  );
}

export default App;

