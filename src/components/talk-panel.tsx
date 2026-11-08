import { NoteBanner } from "@/components/note-banner";
import { PushToTalkButton } from "@/components/push-to-talk-button";
import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { FeedItem, PeerInfo } from "@/lib/types";

interface TalkPanelProps {
  latestNote: FeedItem | null;
  speaker: PeerInfo | null;
  isTalking: boolean;
  isReady: boolean;
  onStart: () => void;
  onStop: () => void;
}

// The heart of both views: the latest AI note, who's on air, and the big push-to-talk button.
export const TalkPanel = ({
  latestNote,
  speaker,
  isTalking,
  isReady,
  onStart,
  onStop,
}: TalkPanelProps): JSX.Element => {
  const hasSpeaker: boolean = speaker !== null;
  const isBusy: boolean = hasSpeaker && !isTalking;
  const canTalk: boolean = isReady && !isBusy;
  const speakerLabel: string = speaker === null ? "Channel free" : `${speaker.name} is talking`;
  const speakerClassName: string = cn("text-center font-bold", {
    "text-green-400": hasSpeaker,
    "text-zinc-500": !hasSpeaker,
  });
  const noteBanner: JSX.Element | null =
    latestNote === null ? null : <NoteBanner key={latestNote.id} item={latestNote} />;

  return (
    <div className="flex flex-1 flex-col gap-6">
      {noteBanner}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <p className={speakerClassName}>{speakerLabel}</p>
        <PushToTalkButton
          isTalking={isTalking}
          isBusy={isBusy}
          isDisabled={!canTalk}
          onStart={onStart}
          onStop={onStop}
        />
      </div>
    </div>
  );
};
