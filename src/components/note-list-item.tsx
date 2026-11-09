import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { FeedItem } from "@/lib/types";

interface NoteListItemProps {
  item: FeedItem;
}

// An earlier AI note in the folded list (members see notes only, never transcripts).
// Urgent notes keep a red border, so they stand out in the history.
export const NoteListItem = ({ item }: NoteListItemProps): JSX.Element => {
  const time: string = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const itemClassName: string = cn("flex flex-col gap-0.5 border-l-2 pl-3", {
    "border-red-500": item.priority === "urgent",
    "border-amber-300/40": item.priority === "info",
  });

  return (
    <li className={itemClassName}>
      <span className="text-xs text-zinc-500">
        {item.speaker.name} · {time}
      </span>
      <span>{item.note}</span>
    </li>
  );
};
