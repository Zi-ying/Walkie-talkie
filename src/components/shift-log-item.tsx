import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { ShiftEvent } from "@/lib/types";

interface ShiftLogItemProps {
  event: ShiftEvent;
}

const shiftEventText = (event: ShiftEvent): string => {
  switch (event.kind) {
    case "on-shift":
      return `${event.peer.name} is on shift`;
    case "ended-shift":
      return `${event.peer.name} ended shift`;
    case "lost-connection":
      return `⚠ ${event.peer.name} lost connection`;
  }
};

export const ShiftLogItem = ({ event }: ShiftLogItemProps): JSX.Element => {
  const time: string = new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const text: string = shiftEventText(event);
  const isLost: boolean = event.kind === "lost-connection";
  const textClassName: string = cn({ "text-amber-400": isLost });

  return (
    <li className="flex gap-2">
      <span className="shrink-0 text-zinc-500">{time}</span>
      <span className={textClassName}>{text}</span>
    </li>
  );
};
