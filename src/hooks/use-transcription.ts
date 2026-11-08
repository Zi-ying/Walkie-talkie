import { useEffect, useRef } from "react";

import { startListening } from "@/lib/speech";

import type { RefObject } from "react";
import type { Listener } from "@/lib/speech";

// Speech-to-text while we're on air: starts when `isTalking` becomes true, and when it becomes
// false, stops and hands over what was heard. Knows nothing about the radio or PeerJS.
export const useTranscription = (
  isTalking: boolean,
  onTranscript: (text: string) => void,
): void => {
  // Always call the latest callback, without restarting the listener when it changes.
  const onTranscriptRef: RefObject<(text: string) => void> = useRef<(text: string) => void>(onTranscript);
  useEffect((): void => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect((): (() => void) | undefined => {
    if (!isTalking) {
      return undefined;
    }
    const listener: Listener | null = startListening();
    if (listener === null) {
      return undefined; // this browser can't transcribe
    }
    return (): void => {
      void listener.stop().then((text: string): void => {
        if (text !== "") {
          onTranscriptRef.current(text);
        }
      });
    };
  }, [isTalking]);
};
