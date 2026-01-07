export async function getAudioContext(): Promise<AudioContext> {
  // Allow browser to choose native sample rate (44100, 48000, etc.)
  // This prevents failure on Android devices that don't support forced resampling in low-latency mode.
  const audioContext = new AudioContext({
    latencyHint: 'interactive',
  });
  return audioContext;
}

export async function getMicrophoneStream(audioContext: AudioContext): Promise<MediaStream> {
  // FIX: Force "Standard" Audio Path
  // The "Low Latency / Raw" path (latency: 0, echoCancellation: false) is silent on this device.
  // We explicitly request processing to force the robust WebRTC audio path.
  const constraints = {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      autoGainControl: true,
      noiseSuppression: true,
      // latency: { ideal: 0 } // REMOVE latency constraint
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
