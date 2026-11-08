import { useRef, useState } from "react";

import {
  getMicrophone,
  playRemoteStream,
  stopAudio,
  stopStream,
} from "@/lib/audio";
import { generateId } from "@/lib/ids";
import {
  answerCalls,
  callPeer,
  closeWhenUnreachable,
  createPeer,
  keepConnectedToServer,
  memberPeerId,
  parseMessage,
  sendAndClose,
  sendMessage,
} from "@/lib/peer";
import { dispatchPeerId } from "@/lib/types";

import type { RefObject } from "react";
import type {
  DataConnection,
  MediaConnection,
  Peer,
  PeerError,
  PeerErrorType,
} from "peerjs";
import type {
  ChannelApi,
  ChannelStatus,
  PeerInfo,
  Role,
  ShiftEvent,
  ShiftEventKind,
  WireMessage,
} from "@/lib/types";

// How long a member waits before trying dispatch again when it isn't online.
const RETRY_DELAY_MS: number = 3000;

// Dispatch's view of one member.
type MemberEntry = {
  connection: DataConnection;
  info: PeerInfo;
  saidBye: boolean;
};

const newShiftEvent = (peer: PeerInfo, kind: ShiftEventKind): ShiftEvent => ({
  id: generateId(),
  peer,
  kind,
  at: Date.now(),
});

// The whole channel: PeerJS connections, voice, roster and shift log.
// Dispatch is the hub: members connect to it (data + voice), it keeps the roster and the shift log.
export const useChannel = (): ChannelApi => {
  const [status, setStatus] = useState<ChannelStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [me, setMe] = useState<PeerInfo | null>(null);
  const [roster, setRoster] = useState<PeerInfo[]>([]);
  const [shiftLog, setShiftLog] = useState<ShiftEvent[]>([]);
  const [hearingCount, setHearingCount] = useState<number>(0);

  // Refs: PeerJS handlers are created once (at join) and must always see the latest values.
  const peerRef: RefObject<Peer | null> = useRef<Peer | null>(null);
  const meRef: RefObject<PeerInfo | null> = useRef<PeerInfo | null>(null);
  const rosterRef: RefObject<PeerInfo[]> = useRef<PeerInfo[]>([]);
  const shiftLogRef: RefObject<ShiftEvent[]> = useRef<ShiftEvent[]>([]);
  const microphoneRef: RefObject<MediaStream | null> = useRef<MediaStream | null>(null);
  const remoteAudiosRef: RefObject<Map<string, HTMLAudioElement>> = useRef<
    Map<string, HTMLAudioElement>
  >(new Map<string, HTMLAudioElement>()); // keyed by remote peer id
  const isLeavingRef: RefObject<boolean> = useRef<boolean>(false);
  const retryTimerRef: RefObject<number | null> = useRef<number | null>(null);
  // Dispatch only
  const membersRef: RefObject<Map<string, MemberEntry>> = useRef<
    Map<string, MemberEntry>
  >(new Map<string, MemberEntry>());
  // Member only
  const dispatchConnectionRef: RefObject<DataConnection | null> = useRef<DataConnection | null>(null);
  const dispatchCallRef: RefObject<MediaConnection | null> = useRef<MediaConnection | null>(null);
  const dispatchSaidByeRef: RefObject<boolean> = useRef<boolean>(false);

  // ---------- State that handlers also read ----------

  const updateRoster = (peers: PeerInfo[]): void => {
    rosterRef.current = peers;
    setRoster(peers);
  };

  const updateShiftLog = (events: ShiftEvent[]): void => {
    shiftLogRef.current = events;
    setShiftLog(events);
  };

  const appendShiftEvent = (event: ShiftEvent): void => {
    updateShiftLog([...shiftLogRef.current, event]);
  };

  // ---------- Audio ----------

  const playAudioFrom = (remotePeerId: string, stream: MediaStream): void => {
    const remoteAudios: Map<string, HTMLAudioElement> = remoteAudiosRef.current;
    // PeerJS can fire "stream" twice for the same call: play each person only once.
    if (remoteAudios.has(remotePeerId)) {
      return;
    }
    remoteAudios.set(remotePeerId, playRemoteStream(stream));
    setHearingCount(remoteAudios.size);
  };

  const stopAudioFrom = (remotePeerId: string): void => {
    const remoteAudios: Map<string, HTMLAudioElement> = remoteAudiosRef.current;
    const audio: HTMLAudioElement | undefined = remoteAudios.get(remotePeerId);
    if (audio === undefined) {
      return;
    }
    stopAudio(audio);
    remoteAudios.delete(remotePeerId);
    setHearingCount(remoteAudios.size);
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

  // ---------- Dispatch side ----------

  const broadcast = (message: WireMessage): void => {
    membersRef.current.forEach((member: MemberEntry): void =>
      sendMessage(member.connection, message),
    );
  };

  const publishRoster = (): void => {
    const members: PeerInfo[] = [...membersRef.current.values()].map(
      (member: MemberEntry): PeerInfo => member.info,
    );
    const peers: PeerInfo[] = meRef.current === null ? members : [meRef.current, ...members];
    updateRoster(peers);
    broadcast({ type: "roster", peers });
  };

  const recordShiftEvent = (peer: PeerInfo, kind: ShiftEventKind): void => {
    const event: ShiftEvent = newShiftEvent(peer, kind);
    appendShiftEvent(event);
    broadcast({ type: "shift-event", event });
  };

  const handleMemberMessage = (connection: DataConnection, message: WireMessage): void => {
    switch (message.type) {
      case "hello": {
        // The id and role come from the connection itself, only the name from the message.
        const info: PeerInfo = { id: connection.peer, name: message.peer.name, role: "member" };
        membersRef.current.set(connection.peer, { connection, info, saidBye: false });
        sendMessage(connection, { type: "shift-log", events: shiftLogRef.current });
        recordShiftEvent(info, "on-shift");
        publishRoster();
        break;
      }
      case "bye": {
        const member: MemberEntry | undefined = membersRef.current.get(connection.peer);
        if (member !== undefined) {
          member.saidBye = true;
        }
        break;
      }
      default:
        // roster, shift-log and shift-event only go from dispatch to members.
        break;
    }
  };

  const handleMemberGone = (remotePeerId: string): void => {
    const member: MemberEntry | undefined = membersRef.current.get(remotePeerId);
    if (member === undefined) {
      return;
    }
    membersRef.current.delete(remotePeerId);
    stopAudioFrom(remotePeerId);
    if (isLeavingRef.current) {
      return; // we are closing the channel ourselves
    }
    recordShiftEvent(member.info, member.saidBye ? "ended-shift" : "lost-connection");
    publishRoster();
  };

  const acceptMembers = (peer: Peer): void => {
    peer.on("connection", (connection: DataConnection): void => {
      closeWhenUnreachable(connection);
      connection.on("data", (data: unknown): void => {
        const message: WireMessage | null = parseMessage(data);
        if (message !== null) {
          handleMemberMessage(connection, message);
        }
      });
      connection.on("close", (): void => handleMemberGone(connection.peer));
    });
  };

  // ---------- Member side ----------

  const stopRetrying = (): void => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const forgetDispatch = (dispatchId: string): void => {
    // Clear the refs first: closing fires "close", which must not be handled as dispatch leaving.
    const connection: DataConnection | null = dispatchConnectionRef.current;
    const call: MediaConnection | null = dispatchCallRef.current;
    dispatchConnectionRef.current = null;
    dispatchCallRef.current = null;
    if (connection !== null) {
      connection.close();
    }
    if (call !== null) {
      call.close();
    }
    stopAudioFrom(dispatchId);
  };

  const handleDispatchMessage = (message: WireMessage): void => {
    switch (message.type) {
      case "roster":
        updateRoster(message.peers);
        break;
      case "shift-log":
        updateShiftLog(message.events);
        break;
      case "shift-event":
        appendShiftEvent(message.event);
        break;
      case "bye":
        dispatchSaidByeRef.current = true;
        break;
      default:
        // hello only goes from members to dispatch.
        break;
    }
  };

  const connectToDispatch = (peer: Peer, channel: string): void => {
    const dispatchId: string = dispatchPeerId(channel);
    dispatchSaidByeRef.current = false;
    const connection: DataConnection = peer.connect(dispatchId, { reliable: true });
    dispatchConnectionRef.current = connection;
    closeWhenUnreachable(connection);

    connection.on("open", (): void => {
      if (meRef.current === null || microphoneRef.current === null) {
        return;
      }
      sendMessage(connection, { type: "hello", peer: meRef.current });
      dispatchCallRef.current = callPeer(peer, dispatchId, microphoneRef.current, playAudioFrom);
      setStatus("ready");
    });

    connection.on("data", (data: unknown): void => {
      const message: WireMessage | null = parseMessage(data);
      if (message !== null) {
        handleDispatchMessage(message);
      }
    });

    // Dispatch closed the channel or dropped: log it, then wait for a dispatch again.
    connection.on("close", (): void => {
      if (isLeavingRef.current || connection !== dispatchConnectionRef.current) {
        return;
      }
      const dispatchInfo: PeerInfo | undefined = rosterRef.current.find(
        (rosterPeer: PeerInfo): boolean => rosterPeer.role === "dispatch",
      );
      if (dispatchInfo !== undefined) {
        appendShiftEvent(
          newShiftEvent(dispatchInfo, dispatchSaidByeRef.current ? "ended-shift" : "lost-connection"),
        );
      }
      forgetDispatch(dispatchId);
      updateRoster([]);
      setStatus("waiting-dispatch");
      scheduleRetry(peer, channel);
    });
  };

  const scheduleRetry = (peer: Peer, channel: string): void => {
    stopRetrying();
    retryTimerRef.current = window.setTimeout((): void => {
      retryTimerRef.current = null;
      connectToDispatch(peer, channel);
    }, RETRY_DELAY_MS);
  };

  // ---------- Public API ----------

  const join = async (name: string, channel: string, role: Role): Promise<void> => {
    setErrorMessage("");
    setStatus("connecting");
    isLeavingRef.current = false;
    updateRoster([]);
    updateShiftLog([]);
    try {
      // Ask for the mic first: this runs inside the Join click, which browsers require.
      microphoneRef.current = await getMicrophone();
      const id: string = role === "dispatch" ? dispatchPeerId(channel) : memberPeerId(channel);
      const peer: Peer = await createPeer(id);
      peerRef.current = peer;

      const self: PeerInfo = { id: peer.id, name, role };
      meRef.current = self;
      setMe(self);

      keepConnectedToServer(peer, (): boolean => isLeavingRef.current);
      answerCalls(peer, microphoneRef.current, playAudioFrom);

      if (role === "dispatch") {
        acceptMembers(peer);
        publishRoster();
        recordShiftEvent(self, "on-shift");
        setStatus("ready");
        return;
      }

      // "peer-unavailable" is not fatal: dispatch isn't online yet, so wait and try again.
      peer.on("error", (error: PeerError<`${PeerErrorType}`>): void => {
        if (error.type === "peer-unavailable" && !isLeavingRef.current) {
          forgetDispatch(dispatchPeerId(channel));
          setStatus("waiting-dispatch");
          scheduleRetry(peer, channel);
        }
      });
      setStatus("waiting-dispatch");
      connectToDispatch(peer, channel);
    } catch (error: unknown) {
      stopAllAudio();
      setStatus("idle");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Microphone access is needed to use the radio.");
      } else {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }
  };

  // Says "bye" to everyone we're connected to (so they log "ended shift", not "lost connection"),
  // then destroys the peer, which releases our id on the PeerJS server.
  const leave = async (): Promise<void> => {
    const peer: Peer | null = peerRef.current;
    if (peer === null) {
      return;
    }
    // Set before destroy(): destroy() fires "disconnected", which must not trigger a reconnect.
    isLeavingRef.current = true;
    stopRetrying();
    if (meRef.current !== null) {
      appendShiftEvent(newShiftEvent(meRef.current, "ended-shift"));
    }

    const connections: DataConnection[] = [];
    membersRef.current.forEach((member: MemberEntry): void => {
      connections.push(member.connection);
    });
    if (dispatchConnectionRef.current !== null && dispatchConnectionRef.current.open) {
      connections.push(dispatchConnectionRef.current);
    }
    await Promise.all(
      connections.map(
        (connection: DataConnection): Promise<void> => sendAndClose(connection, { type: "bye" }),
      ),
    );

    peer.destroy();
    peerRef.current = null;
    meRef.current = null;
    membersRef.current.clear();
    dispatchConnectionRef.current = null;
    dispatchCallRef.current = null;
    stopAllAudio();
    setMe(null);
    updateRoster([]);
    setStatus("idle");
  };

  return { status, errorMessage, me, roster, shiftLog, hearingCount, join, leave };
};
