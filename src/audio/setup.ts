export async function getAudioContext(): Promise<AudioContext> {
  // Allow browser to choose native sample rate (44100, 48000, etc.)
  // This prevents failure on Android devices that don't support forced resampling in low-latency mode.
  const audioContext = new AudioContext({
    latencyHint: 'interactive',
  });
  return audioContext;
}

export async function getMicrophoneStream(audioContext: AudioContext): Promise<MediaStream> {
  const constraints = {
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      channelCount: 1,
      latency: { ideal: 0 },
      // Remove ideal sampleRate constraint to match Context
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
