import { useRef, useState } from "react";

import { ShiftLogItem } from "./components/ShiftLogItem";
import {
  getMicrophone,
  playRemoteStream,
  stopAudio,
  stopStream,
} from "./lib/audio";
import { generateId } from "./lib/ids";
import {
  answerCalls,
  callPeer,
  createPeer,
  keepConnectedToServer,
  memberPeerId,
} from "./lib/peer";
import { dispatchPeerId, isRole } from "./lib/types";

import type { ChangeEvent, JSX, RefObject } from "react";
import type { MediaConnection, Peer, PeerError, PeerErrorType } from "peerjs";
import type {
  ChannelStatus,
  PeerInfo,
  Role,
  ShiftEvent,
  ShiftEventKind,
} from "./lib/types";

// How long a member waits before calling dispatch again when it isn't online yet.
const RETRY_DELAY_MS: number = 3000;

// Temporary test screen for the PeerJS steps. The real UI comes later.
const App = (): JSX.Element => {
  const [name, setName] = useState<string>("");
  const [channel, setChannel] = useState<string>("factory1");
  const [role, setRole] = useState<Role>("member");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [shiftLog, setShiftLog] = useState<ShiftEvent[]>([]);
  const [hearingCount, setHearingCount] = useState<number>(0);
  const [status, setStatus] = useState<ChannelStatus>("idle");

  // Refs, not state: these are not displayed, and handlers created once must see the latest value.
  const microphoneRef: RefObject<MediaStream | null> = useRef<MediaStream | null>(null);
  const remoteAudiosRef: RefObject<Map<string, HTMLAudioElement>> = useRef<
    Map<string, HTMLAudioElement>
  >(new Map<string, HTMLAudioElement>());
  const isLeavingRef: RefObject<boolean> = useRef<boolean>(false);
  const retryTimerRef: RefObject<number | null> = useRef<number | null>(null);
  const dispatchCallRef: RefObject<MediaConnection | null> = useRef<MediaConnection | null>(null);

  const handleRemoteStream = (stream: MediaStream): void => {
    const remoteAudios: Map<string, HTMLAudioElement> = remoteAudiosRef.current;
    // PeerJS can fire "stream" twice for the same call: play each stream only once.
    if (remoteAudios.has(stream.id)) {
      return;
    }
    remoteAudios.set(stream.id, playRemoteStream(stream));
    setHearingCount(remoteAudios.size);
    setStatus("ready");
  };

  // Members call dispatch. If dispatch isn't online yet, the "peer-unavailable" error retries this.
  const callDispatch = (activePeer: Peer): void => {
    if (microphoneRef.current === null) {
      return;
    }
    dispatchCallRef.current = callPeer(
      activePeer,
      dispatchPeerId(channel),
      microphoneRef.current,
      handleRemoteStream,
    );
  };

  const stopRetrying = (): void => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const stopAllAudio = (): void => {
    remoteAudiosRef.current.forEach((audio: HTMLAudioElement): void => stopAudio(audio));
    remoteAudiosRef.current.clear();
    setHearingCount(0);
    if (microphoneRef.current !== null) {
      stopStream(microphoneRef.current);
      microphoneRef.current = null;
    }
  };

  // For now only our own events. In step 2, dispatch shares everyone's events.
  const addShiftEvent = (peerInfo: PeerInfo, kind: ShiftEventKind): void => {
    const event: ShiftEvent = {
      id: generateId(),
      peer: peerInfo,
      kind,
      at: Date.now(),
    };
    setShiftLog((previous: ShiftEvent[]): ShiftEvent[] => [...previous, event]);
  };

  const myInfo = (id: string): PeerInfo => ({ id, name, role });

  const join = async (): Promise<void> => {
    setErrorMessage("");
    setStatus("connecting");
    isLeavingRef.current = false;
    try {
      // Ask for the mic first: this runs inside the Join click, which browsers require.
      microphoneRef.current = await getMicrophone();
      const id: string =
        role === "dispatch" ? dispatchPeerId(channel) : memberPeerId(channel);
      const newPeer: Peer = await createPeer(id);

      keepConnectedToServer(newPeer, (): boolean => isLeavingRef.current);

      // "peer-unavailable" is not fatal: dispatch isn't online yet, so wait and call again.
      newPeer.on("error", (error: PeerError<`${PeerErrorType}`>): void => {
        if (error.type === "peer-unavailable" && !isLeavingRef.current) {
          setStatus("waiting-dispatch");
          if (dispatchCallRef.current !== null) {
            dispatchCallRef.current.close();
          }
          stopRetrying();
          retryTimerRef.current = window.setTimeout(
            (): void => callDispatch(newPeer),
            RETRY_DELAY_MS,
          );
        }
      });

      // Everyone answers incoming calls; members also call dispatch.
      answerCalls(newPeer, microphoneRef.current, handleRemoteStream);
      if (role === "member") {
        setStatus("waiting-dispatch");
        callDispatch(newPeer);
      } else {
        setStatus("ready");
      }

      setPeer(newPeer);
      addShiftEvent(myInfo(newPeer.id), "on-shift");
    } catch (error: unknown) {
      setStatus("idle");
      stopAllAudio();
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Microphone access is needed to use the radio.");
      } else {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }
  };

  // Leaving is deliberate: members end their shift, dispatch closes the channel for everyone.
  const leave = (): void => {
    if (peer === null) {
      return;
    }
    const question: string =
      role === "dispatch"
        ? "Close the channel? Everyone will be disconnected."
        : "End your shift? Dispatch will see you as off duty.";
    if (!window.confirm(question)) {
      return;
    }
    addShiftEvent(myInfo(peer.id), "ended-shift");
    // Set before destroy(): destroy() fires "disconnected", which must not trigger a reconnect.
    isLeavingRef.current = true;
    stopRetrying();
    // destroy() closes every connection and releases our id on the PeerJS server.
    peer.destroy();
    dispatchCallRef.current = null;
    stopAllAudio();
    setPeer(null);
    setStatus("idle");
  };

  const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value: string = event.target.value;
    if (isRole(value)) {
      setRole(value);
    }
  };

  const isConnected: boolean = peer !== null;
  const canJoin: boolean = name !== "" && !isConnected;

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 p-6 flex flex-col gap-3 max-w-sm">
      <h1 className="text-2xl font-bold">📻 Walkie-Talkie (test)</h1>
      <input
        className="bg-zinc-800 p-2 rounded"
        placeholder="Name"
        value={name}
        disabled={isConnected}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          setName(event.target.value)
        }
      />
      <input
        className="bg-zinc-800 p-2 rounded"
        placeholder="Channel"
        value={channel}
        disabled={isConnected}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          setChannel(event.target.value)
        }
      />
      <select
        className="bg-zinc-800 p-2 rounded"
        value={role}
        disabled={isConnected}
        onChange={handleRoleChange}
      >
        <option value="member">Member</option>
        <option value="dispatch">Dispatch</option>
      </select>
      {isConnected ? (
        <button className="bg-zinc-700 p-2 rounded font-bold" onClick={leave}>
          {role === "dispatch" ? "Close channel" : "End shift"}
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
      {peer !== null && status === "ready" && (
        <p className="text-green-400">Connected as {peer.id}</p>
      )}
      {status === "waiting-dispatch" && (
        <p className="text-amber-400">⏳ Waiting for dispatch…</p>
      )}
      {peer !== null && (
        <p>
          🔊 Hearing {hearingCount} {hearingCount === 1 ? "person" : "people"}
        </p>
      )}
      {errorMessage !== "" && <p className="text-red-400">{errorMessage}</p>}

      <h2 className="text-lg font-bold mt-4">Shift log</h2>
      <ul className="flex flex-col gap-1 text-sm">
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
