import { useState, useRef, useEffect } from 'react';
import { getNoteFromPitch, type NoteData } from '../utils/tuner';
import { type TunerStatus } from '../components/tuner/NoteDisplay';

interface TunerUpdate {
  pitch: number;
  clarity: number;
  bufferrms: number;
}

interface TunerConfig {
  SILENCE_THRESHOLD: number;
  CLARITY_THRESHOLD: number;
  DETECTION_THRESHOLD: number;
  LOCK_TOLERANCE_CENTS: number;
  HOLD_TIME_MS: number;
  SMOOTHING_WINDOW: number;
}

const DEFAULT_TUNER_CONFIG: TunerConfig = {
  SILENCE_THRESHOLD: 0.005, // Lowered from 0.01 for better sensitivity
  CLARITY_THRESHOLD: 0.85,
  DETECTION_THRESHOLD: 0.6, // significantly lowered detection threshold from 0.8
  LOCK_TOLERANCE_CENTS: 4,
  HOLD_TIME_MS: 1500,
  SMOOTHING_WINDOW: 8,
};

const VOICE_TUNER_CONFIG: TunerConfig = {
  ...DEFAULT_TUNER_CONFIG,
  CLARITY_THRESHOLD: 0.70, // Slightly easier lock
  DETECTION_THRESHOLD: 0.5,
  LOCK_TOLERANCE_CENTS: 15, // Wider tolerance for voice
  SMOOTHING_WINDOW: 20,    // Smoother for voice
};

export const useAudioTuner = (currentInstrument: string = 'guitar') => {
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteData, setNoteData] = useState<NoteData>({ note: '--', cents: 0 });
  const [centsHistory, setCentsHistory] = useState<number[]>(new Array(100).fill(0));
  const [volume, setVolume] = useState<number>(0);
  const [micError, setMicError] = useState<boolean>(false);
  
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
    setMicError(false);
  };

  const startTuner = async (sourceNode?: AudioNode) => {
    
    if (audioContextRef.current) return;

    try {
      setMicError(false);
      setIsPaused(false);
      setTunerStatus('listening');
      const AudioContextConstructor = sourceNode?.context.constructor as typeof AudioContext || window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = (sourceNode?.context || new AudioContextConstructor()) as AudioContext;
      await audioContext.resume();
      try {
        await audioContext.audioWorklet.addModule('PitchProcessor.js');
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



// ... inside the onmessage handler
        const config = isVoice ? VOICE_TUNER_CONFIG : DEFAULT_TUNER_CONFIG;

        const handleSilence = (now: number, config: TunerConfig) => {
          if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < config.HOLD_TIME_MS) {
            setTunerStatus('holding');
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = setTimeout(() => {
              setTunerStatus('listening');
              setPitch(null);
            }, config.HOLD_TIME_MS - (now - lastValidTimeRef.current));
          } else if (now - lastValidTimeRef.current >= config.HOLD_TIME_MS) {
            setTunerStatus('listening');
            setPitch(null);
          }
        };

        if (bufferrms < config.SILENCE_THRESHOLD) {
          handleSilence(now, config);
          return;
        }

        const handlePitchDetection = (pitch: number, clarity: number, now: number, config: TunerConfig) => {
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
          lastValidTimeRef.current = now;
          setPitch(pitch);
          const rawData = getNoteFromPitch(pitch);
          const buffer = centsBufferRef.current;
          buffer.push(rawData.cents);
          if (buffer.length > config.SMOOTHING_WINDOW) buffer.shift();
          const smoothedCents = buffer.reduce((a, b) => a + b, 0) / buffer.length;
          
          setNoteData({ note: rawData.note, cents: smoothedCents });
          setCentsHistory(prev => {
            const newHistory = [...prev, smoothedCents];
            return newHistory.slice(Math.max(newHistory.length - 100, 0));
          });

          if (clarity > config.CLARITY_THRESHOLD && Math.abs(smoothedCents) < config.LOCK_TOLERANCE_CENTS) {
            setTunerStatus('locked');
          } else {
            setTunerStatus('detecting');
          }
        };

        if (pitch && clarity > config.DETECTION_THRESHOLD) {
          handlePitchDetection(pitch, clarity, now, config);
        } else {
           if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < config.HOLD_TIME_MS) {
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
      setMicError(true);
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
    micError,
    startTuner,
    stopTuner,
    resumeTuner
  };
};