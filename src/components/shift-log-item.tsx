import type { JSX } from "react";
import type { ShiftEvent } from "@/lib/types";

interface ShiftLogItemProps {
  event: ShiftEvent;
}

const shiftEventText = (event: ShiftEvent): string => {
  const who: string = `${event.peer.name} (${event.peer.id})`;
  switch (event.kind) {
    case "on-shift":
      return `${who} is on shift`;
    case "ended-shift":
      return `${who} ended shift`;
    case "lost-connection":
      return `⚠ ${who} lost connection`;
  }
};

export const ShiftLogItem = ({ event }: ShiftLogItemProps): JSX.Element => {
  const time: string = new Date(event.at).toLocaleTimeString();
  const text: string = shiftEventText(event);

  return (
    <li className="flex gap-2">
      <span className="text-zinc-500">{time}</span>
      <span>{text}</span>
    </li>
  );
};
