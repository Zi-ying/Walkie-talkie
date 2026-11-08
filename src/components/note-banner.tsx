import type { JSX } from "react";
import type { FeedItem } from "@/lib/types";

interface NoteBannerProps {
  item: FeedItem;
}

// The latest AI note in big, high-contrast text: readable at a glance by someone who can't hear.
export const NoteBanner = ({ item }: NoteBannerProps): JSX.Element => {
  const speakerLabel: string = `${item.speaker.name} said`;

  return (
    <section
      className="rounded-lg bg-amber-300 text-zinc-900 p-4 flex flex-col gap-1"
      aria-label="Latest note"
    >
      <span className="text-sm font-bold">{speakerLabel}</span>
      <p className="text-2xl font-bold">{item.note}</p>
    </section>
  );
};
