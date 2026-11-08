import { cn } from "@/lib/cn";

import type { JSX } from "react";

interface PushToTalkButtonProps {
  isTalking: boolean;
  isBusy: boolean; // someone else holds the floor
  isDisabled: boolean;
  onStart: () => void;
  onStop: () => void;
}

const buttonLabel = (isTalking: boolean, isBusy: boolean): string => {
  if (isTalking) {
    return "🔴 Talking… release to stop";
  }
  if (isBusy) {
    return "Channel busy";
  }
  return "Hold to talk";
};

// Hold to talk: pointer events cover mouse and touch. Leaving the button also counts as releasing.
export const PushToTalkButton = ({
  isTalking,
  isBusy,
  isDisabled,
  onStart,
  onStop,
}: PushToTalkButtonProps): JSX.Element => {
  const label: string = buttonLabel(isTalking, isBusy);
  const className: string = cn(
    "p-6 rounded-full font-bold text-lg select-none touch-none disabled:opacity-40",
    { "bg-red-600": isTalking, "bg-orange-600": !isTalking },
  );

  return (
    <button
      className={className}
      disabled={isDisabled}
      onPointerDown={onStart}
      onPointerUp={onStop}
      onPointerLeave={onStop}
      onPointerCancel={onStop}
    >
      {label}
    </button>
  );
};
