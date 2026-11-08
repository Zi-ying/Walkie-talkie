import type { JSX } from "react";
import type { FeedItem } from "@/lib/types";

interface NoteBannerProps {
  item: FeedItem;
}

// The latest AI note in big, high-contrast text: readable at a glance by someone who can't hear.
// It flashes when it appears (give it `key={item.id}` so a new note restarts the animation),
// and screen readers announce it (aria-live).
export const NoteBanner = ({ item }: NoteBannerProps): JSX.Element => {
  const time: string = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <section
      className="animate-note-flash flex flex-col gap-1 rounded-2xl bg-amber-300 p-4 text-zinc-900"
      aria-label="Latest note"
      aria-live="polite"
    >
      <span className="flex justify-between text-sm font-bold">
        <span>{item.speaker.name}</span>
        <span>{time}</span>
      </span>
      <p className="text-2xl font-bold leading-snug">{item.note}</p>
    </section>
  );
};
