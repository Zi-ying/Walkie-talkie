// Speech-to-text with the browser's Web Speech API (Chrome and Edge only).
// Note: Chrome sends the audio to Google's servers to recognise it; see the README.

// The parts of the Web Speech API we use. TypeScript's DOM types don't include it.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// If the browser never reports the end, give up waiting after this long.
const STOP_TIMEOUT_MS: number = 2000;

const findRecognition = (): SpeechRecognitionConstructor | null => {
  if (window.SpeechRecognition !== undefined) {
    return window.SpeechRecognition;
  }
  if (window.webkitSpeechRecognition !== undefined) {
    return window.webkitSpeechRecognition;
  }
  return null;
};

export const isTranscriptionSupported = (): boolean => findRecognition() !== null;

export interface Listener {
  // Stops listening and resolves with everything heard (empty string if nothing).
  stop: () => Promise<string>;
}

// Starts listening right away. Returns null when the browser has no speech recognition.
export const startListening = (): Listener | null => {
  const Recognition: SpeechRecognitionConstructor | null = findRecognition();
  if (Recognition === null) {
    return null;
  }
  const recognition: SpeechRecognitionLike = new Recognition();
  recognition.continuous = true; // keep listening while the button is held
  recognition.interimResults = false; // only final, corrected text
  recognition.lang = navigator.language;

  const heard: string[] = [];
  recognition.onresult = (event: SpeechRecognitionEventLike): void => {
    for (let index: number = event.resultIndex; index < event.results.length; index++) {
      const result: SpeechRecognitionResultLike = event.results[index];
      if (result.isFinal) {
        heard.push(result[0].transcript.trim());
      }
    }
  };
  recognition.onerror = (event: Event): void => {
    console.warn("Speech recognition error", event);
  };
  recognition.start();

  const stop = (): Promise<string> =>
    new Promise<string>((resolve: (text: string) => void): void => {
      const finish = (): void => {
        window.clearTimeout(timeout);
        resolve(heard.join(" ").trim());
      };
      const timeout: number = window.setTimeout(finish, STOP_TIMEOUT_MS);
      // The last words arrive in "result" events just before "end".
      recognition.onend = finish;
      recognition.stop();
    });

  return { stop };
};
