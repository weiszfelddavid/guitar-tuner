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

  const startTuner = async (sourceNode?: AudioNode) => {
    
    if (audioContextRef.current) return;

    try {
      setIsPaused(false);
      setTunerStatus('listening');
      const AudioContextConstructor = sourceNode?.context.constructor as typeof AudioContext || window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = sourceNode?.context || new AudioContextConstructor();
      await audioContext.resume();
      try {
        await audioContext.audioWorklet.addModule(processorUrl);
      } catch(e) {
        console.error("Error adding AudioWorklet module in test:", e);
        throw e; // re-throw to fail the test
      }

      const source = sourceNode || audioContext.createMediaStreamSource(await navigator.mediaDevices.getUserMedia({ audio: true }));
      if ('mediaStream' in source) {
        streamRef.current = (source as MediaStreamAudioSourceNode).mediaStream;
      }
      
      const pitchProcessor = new AudioWorkletNode(audioContext, 'pitch-processor');

      pitchProcessor.port.onmessage = (event) => {
        const { pitch, clarity, bufferrms } = event.data as TunerUpdate;
        const now = Date.now();
        const isVoice = instrumentRef.current === 'voice';
        
        setVolume(bufferrms);

        // Voice Mode Parameters
        const SILENCE_THRESHOLD = 0.005; // Lowered from 0.01 for better sensitivity
        const CLARITY_THRESHOLD = isVoice ? 0.70 : 0.85; // Slightly easier lock
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

        if (pitch && clarity > (isVoice ? 0.5 : 0.6)) { // significantly lowered detection threshold from 0.8
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