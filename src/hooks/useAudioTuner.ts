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
  const instrumentRef = useRef(currentInstrument);
  
  // Smoothing Refs
  const lastReadingsRef = useRef<number[]>([]);
  const targetPitchRef = useRef<number | null>(null);
  const currentPitchRef = useRef<number | null>(null);
  const volumeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const statusRef = useRef<TunerStatus>('idle');
  const noteDataRef = useRef<NoteData>({ note: '--', cents: 0 });

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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setTunerStatus('idle');
    setPitch(null);
    setVolume(0);
    setMicError(false);
    
    // Reset refs
    lastReadingsRef.current = [];
    targetPitchRef.current = null;
    currentPitchRef.current = null;
    statusRef.current = 'idle';
  };

  const startTuner = async (sourceNode?: AudioNode) => {
    
    if (audioContextRef.current) return;

    try {
      setMicError(false);
      setIsPaused(false);
      setTunerStatus('listening');
      statusRef.current = 'listening';

      // 1. Get User Media FIRST to validate permissions
      let stream: MediaStream | null = null;
      let source: AudioNode;

      if (sourceNode) {
        source = sourceNode;
      } else {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            console.error('Microphone permission denied:', err);
            setTunerStatus('idle');
            setMicError(true);
            return; // Stop here if no permission
        }
      }

      // 2. Initialize Audio Context
      const AudioContextConstructor = sourceNode?.context.constructor as typeof AudioContext || window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = (sourceNode?.context || new AudioContextConstructor()) as AudioContext;
      await audioContext.resume();

      // 3. Load Worklet
      try {
        await audioContext.audioWorklet.addModule('PitchProcessor.js');
      } catch(e) {
        console.error("Error adding AudioWorklet module:", e);
        // Do NOT set micError here. This is a system/network error.
        // We might want to set a 'systemError' state in the future.
        alert("Failed to load audio processor. Please check your connection.");
        setTunerStatus('idle');
        return; 
      }

      if (!sourceNode && stream) {
          source = audioContext.createMediaStreamSource(stream);
          streamRef.current = stream;
      } else if (sourceNode) {
          source = sourceNode;
      } else {
          // Should not happen if logic is correct
          return;
      }
      
      const pitchProcessor = new AudioWorkletNode(audioContext, 'pitch-processor');

      pitchProcessor.port.onmessage = (event) => {
        const { pitch: detectedPitch, clarity, bufferrms } = event.data as TunerUpdate;
        const now = Date.now();
        const isVoice = instrumentRef.current === 'voice';
        
        volumeRef.current = bufferrms;
        const config = isVoice ? VOICE_TUNER_CONFIG : DEFAULT_TUNER_CONFIG;

        // Silence Detection
        if (bufferrms < config.SILENCE_THRESHOLD) {
          if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < config.HOLD_TIME_MS) {
            statusRef.current = 'holding';
            // We don't clear pitch during hold yet, just update status
          } else if (now - lastValidTimeRef.current >= config.HOLD_TIME_MS) {
            statusRef.current = 'listening';
            targetPitchRef.current = null;
            lastReadingsRef.current = []; // Reset buffer on silence
          }
          return;
        }

        // Pitch Detection Logic
        if (detectedPitch && clarity > config.DETECTION_THRESHOLD) {
          lastValidTimeRef.current = now;
          
          // Buffer Logic (Max 5 items)
          lastReadingsRef.current.push(detectedPitch);
          if (lastReadingsRef.current.length > 5) {
            lastReadingsRef.current.shift();
          }
          
          // Calculate Average
          const averagePitch = lastReadingsRef.current.reduce((a, b) => a + b, 0) / lastReadingsRef.current.length;
          targetPitchRef.current = averagePitch;

          // Note Data Calculation (using smoothed pitch)
          const rawData = getNoteFromPitch(averagePitch);
          
          // Cents Smoothing for Display
          const buffer = centsBufferRef.current;
          buffer.push(rawData.cents);
          if (buffer.length > config.SMOOTHING_WINDOW) buffer.shift();
          const smoothedCents = buffer.reduce((a, b) => a + b, 0) / buffer.length;
          
          noteDataRef.current = { note: rawData.note, cents: smoothedCents };

          if (clarity > config.CLARITY_THRESHOLD && Math.abs(smoothedCents) < config.LOCK_TOLERANCE_CENTS) {
            statusRef.current = 'locked';
          } else {
            statusRef.current = 'detecting';
          }
        } else {
           if (lastValidTimeRef.current > 0 && (now - lastValidTimeRef.current) < config.HOLD_TIME_MS) {
             statusRef.current = 'holding';
           } else {
             statusRef.current = 'listening';
           }
        }
      };

      source.connect(pitchProcessor);
      pitchProcessor.connect(audioContext.destination);
      audioContextRef.current = audioContext;

      // Start Animation Loop
      const animate = () => {
        // Interpolate Pitch
        if (targetPitchRef.current !== null) {
          if (currentPitchRef.current === null) {
            currentPitchRef.current = targetPitchRef.current;
          } else {
            // Lerp with factor 0.1
            currentPitchRef.current += (targetPitchRef.current - currentPitchRef.current) * 0.1;
          }
        } else {
          // If lost signal, maybe drift back to 0 or null?
          // For now, if holding, we keep it. If listening, we null it.
          if (statusRef.current === 'listening') {
             currentPitchRef.current = null;
          }
        }

        // Batch State Updates
        setPitch(currentPitchRef.current);
        setVolume(volumeRef.current);
        setTunerStatus(statusRef.current);
        setNoteData(noteDataRef.current); // Use the ref directly
        
        // Update Cents History (only if pitch exists)
        if (currentPitchRef.current) {
             // We can use the calculated smoothed cents from onmessage for the graph
             // or derive it from the interpolated pitch. 
             // Using noteDataRef is safer as it aligns with NoteDisplay.
             setCentsHistory(prev => {
                const newHistory = [...prev, noteDataRef.current.cents];
                return newHistory.slice(Math.max(newHistory.length - 100, 0));
             });
        }

        rafRef.current = requestAnimationFrame(animate);
      };
      
      rafRef.current = requestAnimationFrame(animate);

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