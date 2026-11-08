import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { ChannelStatus, PeerInfo } from "@/lib/types";

interface ChannelTopBarProps {
  channelName: string;
  status: ChannelStatus;
  hearingCount: number;
  roster: PeerInfo[];
  speaker: PeerInfo | null;
  leaveLabel: string;
  onLeave: () => void;
}

const statusLabel = (status: ChannelStatus): string => {
  switch (status) {
    case "idle":
    case "connecting":
      return "Connecting…";
    case "waiting-dispatch":
      return "Waiting for dispatch…";
    case "ready":
      return "Connected";
  }
};

// Channel name, connection status, who's online (always visible), and the leave button.
export const ChannelTopBar = ({
  channelName,
  status,
  hearingCount,
  roster,
  speaker,
  leaveLabel,
  onLeave,
}: ChannelTopBarProps): JSX.Element => {
  const isReady: boolean = status === "ready";
  const label: string = statusLabel(status);
  const hearingLabel: string = `Hearing ${hearingCount} ${hearingCount === 1 ? "person" : "people"}`;
  const speakerId: string = speaker === null ? "" : speaker.id;
  const dotClassName: string = cn("size-2 rounded-full", {
    "bg-green-400": isReady,
    "bg-amber-400 animate-pulse": !isReady,
  });

  const isSpeaking = (peer: PeerInfo): boolean => peer.id === speakerId;

  return (
    <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-bold">📻 {channelName}</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400" aria-label={hearingLabel}>
          <span className={dotClassName} />
          {label}
        </span>
      </div>

      {/* Right-aligned, and scrolls sideways (instead of clipping) when there are many people. */}
      <div className="flex min-w-0 flex-1 justify-end">
        <ul className="flex min-w-0 -space-x-1 overflow-x-auto p-1" aria-label="Online">
          {roster.map(
            (peer: PeerInfo): JSX.Element => (
              <Avatar key={peer.id} peer={peer} isSpeaking={isSpeaking(peer)} />
            ),
          )}
        </ul>
      </div>

      <button
        type="button"
        className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
        onClick={onLeave}
      >
        {leaveLabel}
      </button>
    </header>
  );
};
