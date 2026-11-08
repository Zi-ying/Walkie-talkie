import { FeedEntry } from "@/components/feed-entry";
import { NoteBanner } from "@/components/note-banner";
import { PushToTalkButton } from "@/components/push-to-talk-button";
import { RosterItem } from "@/components/roster-item";
import { ShiftLogItem } from "@/components/shift-log-item";
import { isLlmAvailable } from "@/lib/llm";
import { isTranscriptionSupported } from "@/lib/speech";

import type { JSX } from "react";
import type { ChannelApi, FeedItem, PeerInfo, ShiftEvent } from "@/lib/types";

interface ChannelScreenProps {
  channelApi: ChannelApi;
  onLeave: () => void;
}

// Temporary connected screen: replaced by the member and Dispatch views.
export const ChannelScreen = ({ channelApi, onLeave }: ChannelScreenProps): JSX.Element => {
  const { status, errorMessage, me, roster, shiftLog, hearingCount, speaker, isTalking, feed } =
    channelApi;

  const isDispatch: boolean = me !== null && me.role === "dispatch";
  const isConnecting: boolean = status === "connecting";
  const isWaitingForDispatch: boolean = status === "waiting-dispatch";
  const hasError: boolean = errorMessage !== "";

  const myId: string = me === null ? "" : me.id;
  const isReady: boolean = status === "ready" && myId !== "";
  const leaveLabel: string = isDispatch ? "Close channel" : "End shift";
  const hearingAriaLabel: string = `Hearing ${hearingCount} ${hearingCount === 1 ? "person" : "people"}`;
  const hearingLabel: string = `🔊 ${hearingAriaLabel}`;

  const isBusy: boolean = speaker !== null && !isTalking;
  const canTalk: boolean = status === "ready" && !isBusy;
  const speakerLabel: string = speaker === null ? "Channel free" : `🔴 ${speaker.name} is talking`;

  const showTranscriptionHint: boolean = isReady && !isTranscriptionSupported();
  const showNoApiKeyHint: boolean = isReady && isDispatch && !isLlmAvailable();

  const readyNotes: FeedItem[] = feed.filter(
    (item: FeedItem): boolean => item.noteStatus === "ready",
  );
  const latestNote: FeedItem | null =
    readyNotes.length === 0 ? null : readyNotes[readyNotes.length - 1];
  const noteBanner: JSX.Element | null =
    latestNote === null ? null : <NoteBanner item={latestNote} />;

  const isMyself = (peer: PeerInfo): boolean => peer.id === myId;

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 p-6 flex flex-col gap-3 max-w-sm">
      <h1 className="text-2xl font-bold">📻 Walkie-Talkie (test)</h1>
      <button className="bg-zinc-700 p-2 rounded font-bold" onClick={onLeave}>
        {leaveLabel}
      </button>

      {isConnecting && <p className="text-zinc-400">Connecting…</p>}
      {isWaitingForDispatch && (
        <p className="text-amber-400">⏳ Waiting for dispatch…</p>
      )}
      {isReady && <p className="text-green-400">Connected as {myId}</p>}
      <p aria-label={hearingAriaLabel}>{hearingLabel}</p>
      {isReady && <p className="font-bold">{speakerLabel}</p>}
      {isReady && (
        <PushToTalkButton
          isTalking={isTalking}
          isBusy={isBusy}
          isDisabled={!canTalk}
          onStart={channelApi.startTalking}
          onStop={channelApi.stopTalking}
        />
      )}
      {hasError && <p className="text-red-400">{errorMessage}</p>}
      {showTranscriptionHint && (
        <p className="text-zinc-500 text-sm">Transcription only works in Chrome or Edge.</p>
      )}
      {showNoApiKeyHint && (
        <p className="text-zinc-500 text-sm">
          AI notes are off: add VITE_ANTHROPIC_API_KEY to .env to turn them on.
        </p>
      )}

      {noteBanner}

      <h2 className="text-lg font-bold mt-4">Messages</h2>
      <ul className="flex flex-col gap-3 text-sm" aria-label="Messages">
        {feed.map(
          (item: FeedItem): JSX.Element => <FeedEntry key={item.id} item={item} />,
        )}
      </ul>

      <h2 className="text-lg font-bold mt-4">On the channel</h2>
      <ul className="flex flex-col gap-1 text-sm" aria-label="On the channel">
        {roster.map(
          (peer: PeerInfo): JSX.Element => (
            <RosterItem key={peer.id} peer={peer} isMe={isMyself(peer)} />
          ),
        )}
      </ul>

      <h2 className="text-lg font-bold mt-4">Shift log</h2>
      <ul className="flex flex-col gap-1 text-sm" aria-label="Shift log">
        {shiftLog.map(
          (event: ShiftEvent): JSX.Element => (
            <ShiftLogItem key={event.id} event={event} />
          ),
        )}
      </ul>
    </main>
  );
};
