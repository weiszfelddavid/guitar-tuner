import { useState, useRef, useEffect } from 'react';
import { getNoteFromPitch, type NoteData } from '../utils/tuner';
import processorUrl from '../audio/engine/processor?worker&url';
import { type TunerStatus } from '../components/tuner/NoteDisplay';

interface TunerUpdate {
  pitch: number;
  clarity: number;
  bufferrms: number;
}

export const useAudioTuner = (t: (key: string) => string, currentInstrument: string = 'guitar') => {
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteData, setNoteData] = useState<NoteData>({ note: '--', cents: 0 });
  const [centsHistory, setCentsHistory] = useState<number[]>(new Array(100).fill(0));
  const [volume, setVolume] = useState<number>(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const centsBufferRef = useRef<number[]>([]);
  const lastValidTimeRef = useRef<number>(0);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instrumentRef = useRef(currentInstrument);

  useEffect(() => {
    instrumentRef.current = currentInstrument;
  }, [currentInstrument]);

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
    setVolume(0);
  };

  const startTuner = async () => {
    
    if (audioContextRef.current) return;

    try {
      setIsPaused(false);
      setTunerStatus('listening');
      const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextConstructor();
      await audioContext.resume();
      await audioContext.audioWorklet.addModule(processorUrl);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const source = audioContext.createMediaStreamSource(stream);
      
      const pitchProcessor = new AudioWorkletNode(audioContext, 'pitch-processor');

      pitchProcessor.port.onmessage = (event) => {
        const { pitch, clarity, bufferrms } = event.data as TunerUpdate;
        const now = Date.now();
        const isVoice = instrumentRef.current === 'voice';
        
        setVolume(bufferrms);

        // Voice Mode Parameters
        const SILENCE_THRESHOLD = 0.01; 
        const CLARITY_THRESHOLD = isVoice ? 0.75 : 0.90; // Lower clarity threshold for voice
        const LOCK_TOLERANCE_CENTS = isVoice ? 15 : 4;   // Wider tolerance for voice
        const HOLD_TIME_MS = 1500;
        const SMOOTHING_WINDOW = isVoice ? 20 : 8;       // Smoother for voice

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

        if (pitch && clarity > (isVoice ? 0.6 : 0.8)) { // Adjust base detection threshold
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

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTuner();
    };
  }, []);

  const resumeTuner = async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  return {
    tunerStatus,
    isPaused,
    pitch,
    noteData,
    centsHistory,
    volume,
    startTuner,
    stopTuner,
    resumeTuner
  };
};
