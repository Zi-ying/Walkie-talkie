import { ChannelTopBar } from "@/components/channel-top-bar";
import { NoteBanner } from "@/components/note-banner";
import { NoteListItem } from "@/components/note-list-item";
import { PushToTalkButton } from "@/components/push-to-talk-button";
import { cn } from "@/lib/cn";
import { isTranscriptionSupported } from "@/lib/speech";

import type { JSX } from "react";
import type { ChannelApi, FeedItem } from "@/lib/types";

interface MemberViewProps {
  channelApi: ChannelApi;
  channelName: string;
  onLeave: () => void;
}

// The simple view: the latest AI note, who's talking, and a big button. Phone first; on desktop
// the same column is centered. Members see AI notes only (no transcripts, roster list or shift log).
export const MemberView = ({ channelApi, channelName, onLeave }: MemberViewProps): JSX.Element => {
  const { status, errorMessage, roster, hearingCount, speaker, isTalking, feed } = channelApi;

  const isReady: boolean = status === "ready";
  const isBusy: boolean = speaker !== null && !isTalking;
  const canTalk: boolean = isReady && !isBusy;
  const hasError: boolean = errorMessage !== "";
  const showTranscriptionHint: boolean = isReady && !isTranscriptionSupported();

  const hasSpeaker: boolean = speaker !== null;
  const speakerLabel: string = speaker === null ? "Channel free" : `${speaker.name} is talking`;
  const speakerClassName: string = cn("text-center font-bold", {
    "text-green-400": hasSpeaker,
    "text-zinc-500": !hasSpeaker,
  });

  // Notes only, newest first. The newest one is the banner, the rest are folded away.
  const notes: FeedItem[] = feed
    .filter((item: FeedItem): boolean => item.noteStatus === "ready")
    .reverse();
  const latestNote: FeedItem | null = notes.length === 0 ? null : notes[0];
  const earlierNotes: FeedItem[] = notes.slice(1);
  const hasEarlierNotes: boolean = earlierNotes.length > 0;
  const earlierNotesLabel: string = `Earlier notes (${earlierNotes.length})`;
  const noteBanner: JSX.Element | null =
    latestNote === null ? null : <NoteBanner key={latestNote.id} item={latestNote} />;

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
        {noteBanner}

        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className={speakerClassName}>{speakerLabel}</p>
          <PushToTalkButton
            isTalking={isTalking}
            isBusy={isBusy}
            isDisabled={!canTalk}
            onStart={channelApi.startTalking}
            onStop={channelApi.stopTalking}
          />
        </div>

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
