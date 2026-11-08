import type { FeedItem } from "@/lib/types";

// Feed items that have an AI note, newest first.
export const readyNotesNewestFirst = (feed: FeedItem[]): FeedItem[] =>
  feed.filter((item: FeedItem): boolean => item.noteStatus === "ready").reverse();

// All feed items, newest first.
export const newestFirst = (feed: FeedItem[]): FeedItem[] => [...feed].reverse();
