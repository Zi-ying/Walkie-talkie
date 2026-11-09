import type { FeedItem } from "@/lib/types";

export const readyNotesNewestFirst = (feed: FeedItem[]): FeedItem[] =>
  feed.filter((item: FeedItem): boolean => item.noteStatus === "ready").reverse();

export const newestFirst = (feed: FeedItem[]): FeedItem[] => [...feed].reverse();
