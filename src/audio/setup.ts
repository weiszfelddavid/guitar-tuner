export async function getAudioContext(): Promise<AudioContext> {
  // Allow browser to choose native sample rate (44100, 48000, etc.)
  // This prevents failure on Android devices that don't support forced resampling in low-latency mode.
  const audioContext = new AudioContext({
    latencyHint: 'interactive',
  });
  return audioContext;
}

export async function getMicrophoneStream(audioContext: AudioContext): Promise<MediaStream> {
  // Relaxed constraints to fix "Silent Stream" on Android.
  // Many Android devices FAIL to provide audio if EchoCancellation is forced to false.
  // We prioritize 'latency' but accept default processing if needed.
  const constraints = {
    audio: {
      channelCount: 1,
      latency: { ideal: 0 },
      // We do NOT strictly force these to false anymore, as it breaks some Android hardware paths.
      // echoCancellation: false, 
      // autoGainControl: false, 
      // noiseSuppression: false, 
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err) {
    console.error("Error accessing microphone:", err);
    throw err;
  }
}
