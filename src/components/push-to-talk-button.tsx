import { cn } from "@/lib/cn";

import type { JSX } from "react";

interface PushToTalkButtonProps {
  isTalking: boolean;
  isBusy: boolean;
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

export const PushToTalkButton = ({
  isTalking,
  isBusy,
  isDisabled,
  onStart,
  onStop,
}: PushToTalkButtonProps): JSX.Element => {
  const label: string = buttonLabel(isTalking, isBusy);
  const isIdle: boolean = !isTalking && !isBusy;
  const className: string = cn(
    "flex size-44 items-center justify-center rounded-full p-6 text-center text-lg font-bold shadow-lg select-none touch-none transition-colors md:size-52 disabled:opacity-40",
    {
      "bg-red-600 ring-8 ring-red-600/30": isTalking,
      "bg-zinc-700": isBusy,
      "bg-orange-600 hover:bg-orange-500": isIdle,
    },
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
