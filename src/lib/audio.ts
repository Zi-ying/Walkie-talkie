export const getMicrophone = (): Promise<MediaStream> => {
  if (!window.isSecureContext) {
    return Promise.reject(
      new Error(
        "The microphone only works over HTTPS. Open the https:// address of this page.",
      ),
    );
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
};

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

export const setMicrophoneEnabled = (
  stream: MediaStream,
  enabled: boolean,
): void => {
  stream.getAudioTracks().forEach((track: MediaStreamTrack): void => {
    track.enabled = enabled;
  });
};

export const stopStream = (stream: MediaStream): void => {
  stream.getTracks().forEach((track: MediaStreamTrack): void => track.stop());
};
