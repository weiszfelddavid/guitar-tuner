export async function getAudioContext(): Promise<AudioContext> {
  const audioContext = new AudioContext({
    latencyHint: 'interactive',
    sampleRate: 48000,
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
      sampleRate: { ideal: 48000 }
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
