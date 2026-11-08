import { useState } from "react";

import { ChannelTopBar } from "@/components/channel-top-bar";
import { CollapsibleSection } from "@/components/collapsible-section";
import { FeedEntry } from "@/components/feed-entry";
import { RosterItem } from "@/components/roster-item";
import { ShiftLogItem } from "@/components/shift-log-item";
import { TabButton } from "@/components/tab-button";
import { TalkPanel } from "@/components/talk-panel";
import { cn } from "@/lib/cn";
import { isLlmAvailable } from "@/lib/llm";
import { newestFirst, readyNotesNewestFirst } from "@/lib/notes";
import { isTranscriptionSupported } from "@/lib/speech";

import type { JSX } from "react";
import type { DispatchTab, TabDetails } from "@/components/tab-button";
import type { ChannelApi, FeedItem, PeerInfo, ShiftEvent } from "@/lib/types";

interface DispatchViewProps {
  channelApi: ChannelApi;
  channelName: string;
  onLeave: () => void;
}

const TABS: TabDetails[] = [
  { tab: "team", label: "Team", icon: "👥" },
  { tab: "talk", label: "Talk", icon: "🎙️" },
  { tab: "notes", label: "Notes", icon: "📝" },
];

// The overview: team and shift log, talk, and every note with its original words.
// Desktop: three columns side by side. Phone: one panel at a time, picked with a bottom tab bar.
export const DispatchView = ({ channelApi, channelName, onLeave }: DispatchViewProps): JSX.Element => {
  const { status, errorMessage, me, roster, shiftLog, hearingCount, speaker, isTalking, feed } =
    channelApi;
  const [activeTab, setActiveTab] = useState<DispatchTab>("talk");

  const isReady: boolean = status === "ready";
  const hasError: boolean = errorMessage !== "";
  const showNoApiKeyHint: boolean = isReady && !isLlmAvailable();
  const showTranscriptionHint: boolean = isReady && !isTranscriptionSupported();

  const myId: string = me === null ? "" : me.id;
  const speakerId: string = speaker === null ? "" : speaker.id;
  const notes: FeedItem[] = readyNotesNewestFirst(feed);
  const latestNote: FeedItem | null = notes.length === 0 ? null : notes[0];
  const messages: FeedItem[] = newestFirst(feed);
  const latestShiftEventsFirst: ShiftEvent[] = [...shiftLog].reverse();
  const isNotesEmpty: boolean = messages.length === 0;
  const teamTitle: string = `On the channel (${roster.length})`;
  const shiftLogTitle: string = `Shift log (${shiftLog.length})`;

  // On phones only the active panel shows; from md up all three show side by side.
  const panelClassName = (tab: DispatchTab): string =>
    cn("flex-col gap-4 overflow-y-auto p-4 md:flex", {
      flex: activeTab === tab,
      hidden: activeTab !== tab,
    });
  const teamPanelClassName: string = cn(panelClassName("team"), "md:border-r md:border-zinc-800");
  const talkPanelClassName: string = panelClassName("talk");
  const notesPanelClassName: string = cn(panelClassName("notes"), "md:border-l md:border-zinc-800");
  const isMyself = (peer: PeerInfo): boolean => peer.id === myId;
  const isSpeaking = (peer: PeerInfo): boolean => peer.id === speakerId;

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <ChannelTopBar
        channelName={channelName}
        status={status}
        hearingCount={hearingCount}
        roster={roster}
        speaker={speaker}
        leaveLabel="Close channel"
        onLeave={onLeave}
      />

      <div className="grid min-h-0 flex-1 md:grid-cols-[16rem_1fr_20rem]">
        <section className={teamPanelClassName} aria-label="Team">
          <CollapsibleSection title={teamTitle}>
            <ul className="flex flex-col gap-2 text-sm" aria-label="On the channel">
              {roster.map(
                (peer: PeerInfo): JSX.Element => (
                  <RosterItem key={peer.id} peer={peer} isMe={isMyself(peer)} isSpeaking={isSpeaking(peer)} />
                ),
              )}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title={shiftLogTitle}>
            <ul className="flex flex-col gap-1 text-xs" aria-label="Shift log">
              {latestShiftEventsFirst.map(
                (event: ShiftEvent): JSX.Element => <ShiftLogItem key={event.id} event={event} />,
              )}
            </ul>
          </CollapsibleSection>
        </section>

        <section className={talkPanelClassName} aria-label="Talk">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4">
            <TalkPanel
              latestNote={latestNote}
              speaker={speaker}
              isTalking={isTalking}
              isReady={isReady}
              onStart={channelApi.startTalking}
              onStop={channelApi.stopTalking}
            />
            {hasError && <p className="text-sm text-red-400">{errorMessage}</p>}
            {showNoApiKeyHint && (
              <p className="text-center text-xs text-zinc-500">
                AI notes are off: add VITE_ANTHROPIC_API_KEY to .env to turn them on.
              </p>
            )}
            {showTranscriptionHint && (
              <p className="text-center text-xs text-zinc-500">
                Transcription needs Chrome or Edge.
              </p>
            )}
          </div>
        </section>

        <section className={notesPanelClassName} aria-label="Notes">
          <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Notes</h2>
          {isNotesEmpty && <p className="text-sm text-zinc-500">Nothing said yet.</p>}
          <ul className="flex flex-col gap-3" aria-label="Messages">
            {messages.map(
              (item: FeedItem): JSX.Element => <FeedEntry key={item.id} item={item} />,
            )}
          </ul>
        </section>
      </div>

      <nav className="flex border-t border-zinc-800 md:hidden" role="tablist" aria-label="Panels">
        {TABS.map(
          (details: TabDetails): JSX.Element => (
            <TabButton key={details.tab} details={details} activeTab={activeTab} onSelect={setActiveTab} />
          ),
        )}
      </nav>
    </div>
  );
};
