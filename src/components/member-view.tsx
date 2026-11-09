import { ChannelTopBar } from "@/components/channel-top-bar";
import { NoteListItem } from "@/components/note-list-item";
import { TalkPanel } from "@/components/talk-panel";
import { readyNotesNewestFirst } from "@/lib/notes";
import { isTranscriptionSupported } from "@/lib/speech";

import type { JSX } from "react";
import type { ChannelApi, FeedItem } from "@/lib/types";

interface MemberViewProps {
  channelApi: ChannelApi;
  channelName: string;
  onLeave: () => void;
}

export const MemberView = ({ channelApi, channelName, onLeave }: MemberViewProps): JSX.Element => {
  const { status, errorMessage, roster, hearingCount, speaker, isTalking, feed } = channelApi;

  const isReady: boolean = status === "ready";
  const hasError: boolean = errorMessage !== "";
  const showTranscriptionHint: boolean = isReady && !isTranscriptionSupported();

  const notes: FeedItem[] = readyNotesNewestFirst(feed);
  const latestNote: FeedItem | null = notes.length === 0 ? null : notes[0];
  const earlierNotes: FeedItem[] = notes.slice(1);
  const hasEarlierNotes: boolean = earlierNotes.length > 0;
  const earlierNotesLabel: string = `Earlier notes (${earlierNotes.length})`;

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      <ChannelTopBar
        channelName={channelName}
        status={status}
        hearingCount={hearingCount}
        roster={roster}
        speaker={speaker}
        leaveLabel="End shift"
        onLeave={onLeave}
      />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
        <TalkPanel
          latestNote={latestNote}
          speaker={speaker}
          isTalking={isTalking}
          isReady={isReady}
          onStart={channelApi.startTalking}
          onStop={channelApi.stopTalking}
        />

        {hasError && <p className="text-sm text-red-400">{errorMessage}</p>}
        {showTranscriptionHint && (
          <p className="text-center text-xs text-zinc-500">
            Notes need speech recognition: use Chrome or Edge.
          </p>
        )}

        {hasEarlierNotes && (
          <details className="rounded-xl bg-zinc-900 p-3 text-sm">
            <summary className="cursor-pointer text-zinc-400">{earlierNotesLabel}</summary>
            <ul className="mt-3 flex flex-col gap-3" aria-label="Earlier notes">
              {earlierNotes.map(
                (item: FeedItem): JSX.Element => <NoteListItem key={item.id} item={item} />,
              )}
            </ul>
          </details>
        )}
      </main>
    </div>
  );
};
