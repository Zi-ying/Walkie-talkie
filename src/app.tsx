import { useState } from "react";

import { PushToTalkButton } from "@/components/push-to-talk-button";
import { RosterItem } from "@/components/roster-item";
import { ShiftLogItem } from "@/components/shift-log-item";
import { useChannel } from "@/hooks/use-channel";
import { isRole } from "@/lib/types";

import type { ChangeEvent, JSX } from "react";
import type { ChannelApi, PeerInfo, Role, ShiftEvent } from "@/lib/types";

// Temporary test screen for the PeerJS steps. The real UI comes later.
const App = (): JSX.Element => {
  const channelApi: ChannelApi = useChannel();
  const { status, errorMessage, me, roster, shiftLog, hearingCount, speaker, isTalking } =
    channelApi;

  const [name, setName] = useState<string>("");
  const [channel, setChannel] = useState<string>("factory1");
  const [role, setRole] = useState<Role>("member");

  const isDispatch: boolean = role === "dispatch";
  const isConnected: boolean = status !== "idle";
  const isConnecting: boolean = status === "connecting";
  const isWaitingForDispatch: boolean = status === "waiting-dispatch";
  const canJoin: boolean = name !== "" && !isConnected;
  const hasError: boolean = errorMessage !== "";

  const myId: string = me === null ? "" : me.id;
  const isReady: boolean = status === "ready" && myId !== "";
  const leaveLabel: string = isDispatch ? "Close channel" : "End shift";
  const hearingLabel: string = `🔊 Hearing ${hearingCount} ${hearingCount === 1 ? "person" : "people"}`;

  const isBusy: boolean = speaker !== null && !isTalking;
  const canTalk: boolean = status === "ready" && !isBusy;
  const speakerLabel: string = speaker === null ? "Channel free" : `🔴 ${speaker.name} is talking`;

  const isMyself = (peer: PeerInfo): boolean => peer.id === myId;

  const join = async (): Promise<void> => {
    await channelApi.join(name, channel, role);
  };

  // Leaving is deliberate: members end their shift, dispatch closes the channel for everyone.
  const leave = async (): Promise<void> => {
    const question: string = isDispatch
      ? "Close the channel? Everyone will be disconnected."
      : "End your shift? Dispatch will see you as off duty.";
    if (window.confirm(question)) {
      await channelApi.leave();
    }
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setName(event.target.value);
  };

  const handleChannelChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setChannel(event.target.value);
  };

  const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value: string = event.target.value;
    if (isRole(value)) {
      setRole(value);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 p-6 flex flex-col gap-3 max-w-sm">
      <h1 className="text-2xl font-bold">📻 Walkie-Talkie (test)</h1>
      <input
        className="bg-zinc-800 p-2 rounded"
        placeholder="Name"
        aria-label="Name"
        value={name}
        disabled={isConnected}
        onChange={handleNameChange}
      />
      <input
        className="bg-zinc-800 p-2 rounded"
        placeholder="Channel"
        aria-label="Channel"
        value={channel}
        disabled={isConnected}
        onChange={handleChannelChange}
      />
      <select
        className="bg-zinc-800 p-2 rounded"
        aria-label="Role"
        value={role}
        disabled={isConnected}
        onChange={handleRoleChange}
      >
        <option value="member">Member</option>
        <option value="dispatch">Dispatch</option>
      </select>
      {isConnected ? (
        <button className="bg-zinc-700 p-2 rounded font-bold" onClick={leave}>
          {leaveLabel}
        </button>
      ) : (
        <button
          className="bg-orange-600 p-2 rounded font-bold disabled:opacity-40"
          disabled={!canJoin}
          onClick={join}
        >
          Join
        </button>
      )}

      {isConnecting && <p className="text-zinc-400">Connecting…</p>}
      {isWaitingForDispatch && (
        <p className="text-amber-400">⏳ Waiting for dispatch…</p>
      )}
      {isReady && <p className="text-green-400">Connected as {myId}</p>}
      {isConnected && <p>{hearingLabel}</p>}
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

export default App;
