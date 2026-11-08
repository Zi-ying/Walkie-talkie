// Browser audio helpers. Must be first called from a user click (browsers block mic and autoplay otherwise).

export const getMicrophone = (): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });

export const playRemoteStream = (stream: MediaStream): HTMLAudioElement => {
  const audio: HTMLAudioElement = new Audio();
  audio.srcObject = stream;
  audio.play().catch((error: unknown): void => {
    console.warn("Could not play remote audio", error);
  });
  return audio;
};

export const stopAudio = (audio: HTMLAudioElement): void => {
  audio.pause();
  audio.srcObject = null;
};

// Stopping the tracks turns off the browser's "mic in use" indicator.
export const stopStream = (stream: MediaStream): void => {
  stream.getTracks().forEach((track: MediaStreamTrack): void => track.stop());
};
