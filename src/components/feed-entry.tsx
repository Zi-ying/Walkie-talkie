import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { FeedItem } from "@/lib/types";

interface FeedEntryProps {
  item: FeedItem;
}

const noteText = (item: FeedItem): string => {
  switch (item.noteStatus) {
    case "pending":
      return "✍️ Writing note…";
    case "ready":
      return `📝 ${item.note}`;
    case "unavailable":
      return "AI note unavailable";
  }
};

export const FeedEntry = ({ item }: FeedEntryProps): JSX.Element => {
  const time: string = new Date(item.at).toLocaleTimeString();
  const note: string = noteText(item);
  const isNoteReady: boolean = item.noteStatus === "ready";
  const noteClassName: string = cn({ "text-amber-300": isNoteReady, "text-zinc-500": !isNoteReady });

  return (
    <li className="flex flex-col gap-1 border-l-2 border-zinc-700 pl-3">
      <div className="flex gap-2 text-zinc-500">
        <span>{time}</span>
        <span className="font-bold text-zinc-300">{item.speaker.name}</span>
      </div>
      <p className="text-zinc-400">“{item.transcript}”</p>
      <p className={noteClassName}>{note}</p>
    </li>
  );
};
