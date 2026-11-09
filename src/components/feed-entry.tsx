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
      return item.note;
    case "unavailable":
      return "AI note unavailable";
  }
};

export const FeedEntry = ({ item }: FeedEntryProps): JSX.Element => {
  const time: string = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const note: string = noteText(item);
  const isNoteReady: boolean = item.noteStatus === "ready";
  const transcript: string = `“${item.transcript}”`;
  const isUrgent: boolean = isNoteReady && item.priority === "urgent";
  const priorityLabel: string = isUrgent ? "🔴 Urgent" : "🟡 Info";
  const noteClassName: string = cn({
    "text-base font-bold text-amber-300": isNoteReady,
    "text-red-400": isUrgent,
    "text-xs text-zinc-500": !isNoteReady,
  });
  const entryClassName: string = cn("flex flex-col gap-1 rounded-xl bg-zinc-900 p-3", {
    "ring-1 ring-red-500": isUrgent,
  });
  const originalWords: JSX.Element = isNoteReady ? (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-zinc-500">Show original words</summary>
      <p className="mt-1 text-zinc-400">{transcript}</p>
    </details>
  ) : (
    <p className="text-sm text-zinc-300">{transcript}</p>
  );

  return (
    <li className={entryClassName}>
      <div className="flex justify-between gap-2 text-xs text-zinc-500">
        <span className="font-bold text-zinc-300">{item.speaker.name}</span>
        {isNoteReady && <span className="ml-auto">{priorityLabel}</span>}
        <span>{time}</span>
      </div>
      <p className={noteClassName}>{note}</p>
      {originalWords}
    </li>
  );
};
