// Browser audio helpers. Must be first called from a user click (browsers block mic and autoplay otherwise).

export const getMicrophone = (): Promise<MediaStream> => {
  // Browsers only give access to the mic on https:// pages or localhost.
  if (!window.isSecureContext) {
    return Promise.reject(
      new Error("The microphone only works over HTTPS. Open the https:// address of this page."),
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

// Push-to-talk: the calls stay open, we only switch the mic track on and off.
// Every call shares this stream, so this mutes or unmutes us for everyone at once.
export const setMicrophoneEnabled = (stream: MediaStream, enabled: boolean): void => {
  stream.getAudioTracks().forEach((track: MediaStreamTrack): void => {
    track.enabled = enabled;
  });
};

// Stopping the tracks turns off the browser's "mic in use" indicator.
export const stopStream = (stream: MediaStream): void => {
  stream.getTracks().forEach((track: MediaStreamTrack): void => track.stop());
};
