import type { JSX } from "react";
import type { FeedItem } from "@/lib/types";

interface NoteListItemProps {
  item: FeedItem;
}

// An earlier AI note in the folded list (members see notes only, never transcripts).
export const NoteListItem = ({ item }: NoteListItemProps): JSX.Element => {
  const time: string = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <li className="flex flex-col gap-0.5 border-l-2 border-amber-300/40 pl-3">
      <span className="text-xs text-zinc-500">
        {item.speaker.name} · {time}
      </span>
      <span>{item.note}</span>
    </li>
  );
};
