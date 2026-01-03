import { useState, useRef, useEffect } from 'react';
import { getNoteFromPitch, type NoteData } from '../utils/tuner';
import processorUrl from '../audio/engine/processor?worker&url';
import { type TunerStatus } from '../components/tuner/NoteDisplay';

interface TunerUpdate {
  pitch: number;
  clarity: number;
  bufferrms: number;
}

export const useAudioTuner = (t: (key: string) => string) => {
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteData, setNoteData] = useState<NoteData>({ note: '--', cents: 0 });
  const [centsHistory, setCentsHistory] = useState<number[]>(new Array(100).fill(0));
  
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
      const SMOOTHING_WINDOW = 8;

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

  return {
    tunerStatus,
    isPaused,
    pitch,
    noteData,
    centsHistory,
    startTuner,
    stopTuner
  };
};
