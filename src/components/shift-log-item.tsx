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

export const ShiftLogItem = ({ event }: ShiftLogItemProps): JSX.Element => (
  <li>
    <span className="text-zinc-500">
      {new Date(event.at).toLocaleTimeString()}
    </span>{" "}
    {shiftEventText(event)}
  </li>
);
