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
  stop: () => Promise<string>;
}

export const startListening = (): Listener | null => {
  const Recognition: SpeechRecognitionConstructor | null = findRecognition();
  if (Recognition === null) {
    return null;
  }
  const recognition: SpeechRecognitionLike = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = false;
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
      recognition.onend = finish;
      recognition.stop();
    });

  return { stop };
};
