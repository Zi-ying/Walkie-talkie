import { useEffect, useRef } from "react";

import { startListening } from "@/lib/speech";

import type { RefObject } from "react";
import type { Listener } from "@/lib/speech";

export const useTranscription = (
  isTalking: boolean,
  onTranscript: (text: string) => void,
): void => {
  const onTranscriptRef: RefObject<(text: string) => void> =
    useRef<(text: string) => void>(onTranscript);
  useEffect((): void => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect((): (() => void) | undefined => {
    if (!isTalking) {
      return undefined;
    }
    const listener: Listener | null = startListening();
    if (listener === null) {
      return undefined;
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
