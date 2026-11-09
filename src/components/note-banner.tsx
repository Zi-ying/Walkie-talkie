import { useEffect } from "react";

import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { FeedItem } from "@/lib/types";

interface NoteBannerProps {
  item: FeedItem;
}

const URGENT_VIBRATION_MS: number[] = [200, 100, 200, 100, 600];

export const NoteBanner = ({ item }: NoteBannerProps): JSX.Element => {
  const isUrgent: boolean = item.priority === "urgent";
  const time: string = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const speakerLabel: string = isUrgent ? `🔴 URGENT · ${item.speaker.name}` : item.speaker.name;
  const announcement: "assertive" | "polite" = isUrgent ? "assertive" : "polite";
  const bannerClassName: string = cn("flex flex-col gap-1 rounded-2xl p-4", {
    "animate-urgent-flash bg-red-600 text-white": isUrgent,
    "animate-note-flash bg-amber-300 text-zinc-900": !isUrgent,
  });

  useEffect((): void => {
    if (isUrgent && "vibrate" in navigator) {
      navigator.vibrate(URGENT_VIBRATION_MS);
    }
  }, [isUrgent]);

  return (
    <section className={bannerClassName} aria-label="Latest note" aria-live={announcement}>
      <span className="flex justify-between text-sm font-bold">
        <span>{speakerLabel}</span>
        <span>{time}</span>
      </span>
      <p className="text-2xl font-bold leading-snug">{item.note}</p>
    </section>
  );
};
