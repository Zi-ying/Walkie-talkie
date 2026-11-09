import { useRef, useState } from "react";

import {
  getMicrophone,
  playRemoteStream,
  setMicrophoneEnabled,
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
  FeedItem,
  PeerInfo,
  Role,
  ShiftEvent,
  ShiftEventKind,
  SimpleNote,
  WireMessage,
} from "@/lib/types";

const RETRY_DELAY_MS: number = 3000;

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

type NoteWriter = (transcript: string) => Promise<SimpleNote | null>;

type ChannelOptions = {
  writeNote?: NoteWriter;
};

export const useChannel = (options: ChannelOptions = {}): ChannelApi => {
  const { writeNote } = options;
  const [status, setStatus] = useState<ChannelStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [me, setMe] = useState<PeerInfo | null>(null);
  const [roster, setRoster] = useState<PeerInfo[]>([]);
  const [shiftLog, setShiftLog] = useState<ShiftEvent[]>([]);
  const [hearingCount, setHearingCount] = useState<number>(0);
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const peerRef: RefObject<Peer | null> = useRef<Peer | null>(null);
  const meRef: RefObject<PeerInfo | null> = useRef<PeerInfo | null>(null);
  const rosterRef: RefObject<PeerInfo[]> = useRef<PeerInfo[]>([]);
  const shiftLogRef: RefObject<ShiftEvent[]> = useRef<ShiftEvent[]>([]);
  const microphoneRef: RefObject<MediaStream | null> = useRef<MediaStream | null>(null);
  const remoteAudiosRef: RefObject<Map<string, HTMLAudioElement>> = useRef<
    Map<string, HTMLAudioElement>
  >(new Map<string, HTMLAudioElement>());
  const isLeavingRef: RefObject<boolean> = useRef<boolean>(false);
  const retryTimerRef: RefObject<number | null> = useRef<number | null>(null);
  const speakerIdRef: RefObject<string | null> = useRef<string | null>(null);
  const isHoldingRef: RefObject<boolean> = useRef<boolean>(false);
  const feedRef: RefObject<FeedItem[]> = useRef<FeedItem[]>([]);
  const membersRef: RefObject<Map<string, MemberEntry>> = useRef<
    Map<string, MemberEntry>
  >(new Map<string, MemberEntry>());
  const dispatchConnectionRef: RefObject<DataConnection | null> = useRef<DataConnection | null>(null);
  const dispatchCallRef: RefObject<MediaConnection | null> = useRef<MediaConnection | null>(null);
  const dispatchSaidByeRef: RefObject<boolean> = useRef<boolean>(false);
  const memberCallsRef: RefObject<Map<string, MediaConnection>> = useRef<
    Map<string, MediaConnection>
  >(new Map<string, MediaConnection>());

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

  const updateFeed = (items: FeedItem[]): void => {
    feedRef.current = items;
    setFeed(items);
  };

  const upsertFeedItem = (item: FeedItem): void => {
    const exists: boolean = feedRef.current.some(
      (existing: FeedItem): boolean => existing.id === item.id,
    );
    updateFeed(
      exists
        ? feedRef.current.map((existing: FeedItem): FeedItem => (existing.id === item.id ? item : existing))
        : [...feedRef.current, item],
    );
  };

  const playAudioFrom = (remotePeerId: string, stream: MediaStream): void => {
    const remoteAudios: Map<string, HTMLAudioElement> = remoteAudiosRef.current;
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

  const applyFloor = (newSpeakerId: string | null): void => {
    speakerIdRef.current = newSpeakerId;
    setSpeakerId(newSpeakerId);
    const iHaveFloor: boolean = meRef.current !== null && newSpeakerId === meRef.current.id;
    if (microphoneRef.current !== null) {
      setMicrophoneEnabled(microphoneRef.current, iHaveFloor && isHoldingRef.current);
    }
    if (iHaveFloor && !isHoldingRef.current) {
      releaseFloor();
    }
  };

  const submitTranscript = (text: string): void => {
    const self: PeerInfo | null = meRef.current;
    if (text === "" || self === null || isLeavingRef.current) {
      return;
    }
    if (self.role === "dispatch") {
      void publishTranscript(self, text);
    } else {
      sendToDispatch({ type: "transcript", text });
    }
  };

  const broadcast = (message: WireMessage): void => {
    membersRef.current.forEach((member: MemberEntry): void =>
      sendMessage(member.connection, message),
    );
  };

  const grantFloor = (newSpeakerId: string | null): void => {
    broadcast({ type: "floor", speakerId: newSpeakerId });
    applyFloor(newSpeakerId);
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

  const shareFeedItem = (item: FeedItem): void => {
    upsertFeedItem(item);
    broadcast({ type: "feed-item", item });
  };

  const publishTranscript = async (speaker: PeerInfo, transcript: string): Promise<void> => {
    const item: FeedItem = {
      id: generateId(),
      speaker,
      transcript,
      note: "",
      noteStatus: writeNote === undefined ? "unavailable" : "pending",
      priority: "info",
      at: Date.now(),
    };
    shareFeedItem(item);
    if (writeNote === undefined) {
      return;
    }
    const simpleNote: SimpleNote | null = await writeNote(transcript);
    if (isLeavingRef.current) {
      return;
    }
    shareFeedItem(
      simpleNote === null
        ? { ...item, noteStatus: "unavailable" }
        : { ...item, note: simpleNote.note, priority: simpleNote.priority, noteStatus: "ready" },
    );
  };

  const handleMemberMessage = (connection: DataConnection, message: WireMessage): void => {
    switch (message.type) {
      case "hello": {
        const info: PeerInfo = { id: connection.peer, name: message.peer.name, role: "member" };
        membersRef.current.set(connection.peer, { connection, info, saidBye: false });
        sendMessage(connection, { type: "shift-log", events: shiftLogRef.current });
        recordShiftEvent(info, "on-shift");
        publishRoster();
        sendMessage(connection, { type: "floor", speakerId: speakerIdRef.current });
        sendMessage(connection, { type: "feed", items: feedRef.current });
        break;
      }
      case "bye": {
        const member: MemberEntry | undefined = membersRef.current.get(connection.peer);
        if (member !== undefined) {
          member.saidBye = true;
        }
        break;
      }
      case "talk-request":
        if (speakerIdRef.current === null && membersRef.current.has(connection.peer)) {
          grantFloor(connection.peer);
        }
        break;
      case "talk-release":
        if (speakerIdRef.current === connection.peer) {
          grantFloor(null);
        }
        break;
      case "transcript": {
        const member: MemberEntry | undefined = membersRef.current.get(connection.peer);
        if (member !== undefined) {
          void publishTranscript(member.info, message.text);
        }
        break;
      }
      default:
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
      return;
    }
    recordShiftEvent(member.info, member.saidBye ? "ended-shift" : "lost-connection");
    publishRoster();
    if (speakerIdRef.current === remotePeerId) {
      grantFloor(null);
    }
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

  const sendToDispatch = (message: WireMessage): void => {
    const connection: DataConnection | null = dispatchConnectionRef.current;
    if (connection !== null && connection.open) {
      sendMessage(connection, message);
    }
  };

  const releaseFloor = (): void => {
    if (meRef.current === null) {
      return;
    }
    if (meRef.current.role === "dispatch") {
      grantFloor(null);
      return;
    }
    if (microphoneRef.current !== null) {
      setMicrophoneEnabled(microphoneRef.current, false);
    }
    sendToDispatch({ type: "talk-release" });
  };

  const stopRetrying = (): void => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const forgetDispatch = (dispatchId: string): void => {
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

  const syncMemberCalls = (peers: PeerInfo[]): void => {
    const peer: Peer | null = peerRef.current;
    const self: PeerInfo | null = meRef.current;
    const microphone: MediaStream | null = microphoneRef.current;
    if (peer === null || self === null || microphone === null) {
      return;
    }
    const peerIds: string[] = peers.map((rosterPeer: PeerInfo): string => rosterPeer.id);

    memberCallsRef.current.forEach((call: MediaConnection, remoteId: string): void => {
      if (!peerIds.includes(remoteId)) {
        call.close();
        memberCallsRef.current.delete(remoteId);
      }
    });
    [...remoteAudiosRef.current.keys()].forEach((remoteId: string): void => {
      if (!peerIds.includes(remoteId)) {
        stopAudioFrom(remoteId);
      }
    });

    peers.forEach((rosterPeer: PeerInfo): void => {
      const shouldCall: boolean =
        rosterPeer.role === "member" &&
        self.id < rosterPeer.id &&
        !memberCallsRef.current.has(rosterPeer.id);
      if (shouldCall) {
        memberCallsRef.current.set(
          rosterPeer.id,
          callPeer(peer, rosterPeer.id, microphone, playAudioFrom),
        );
      }
    });
  };

  const handleDispatchMessage = (message: WireMessage): void => {
    switch (message.type) {
      case "roster":
        updateRoster(message.peers);
        syncMemberCalls(message.peers);
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
      case "floor":
        applyFloor(message.speakerId);
        break;
      case "feed-item":
        upsertFeedItem(message.item);
        break;
      case "feed":
        updateFeed(message.items);
        break;
      default:
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
      syncMemberCalls([]);
      applyFloor(null);
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

  const join = async (name: string, channel: string, role: Role): Promise<void> => {
    setErrorMessage("");
    setStatus("connecting");
    isLeavingRef.current = false;
    isHoldingRef.current = false;
    speakerIdRef.current = null;
    setSpeakerId(null);
    updateRoster([]);
    updateShiftLog([]);
    updateFeed([]);
    try {
      microphoneRef.current = await getMicrophone();
      setMicrophoneEnabled(microphoneRef.current, false);
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

  const leave = async (): Promise<void> => {
    const peer: Peer | null = peerRef.current;
    if (peer === null) {
      return;
    }
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
    memberCallsRef.current.clear();
    stopAllAudio();
    isHoldingRef.current = false;
    speakerIdRef.current = null;
    setSpeakerId(null);
    setMe(null);
    updateRoster([]);
    setStatus("idle");
  };

  const startTalking = (): void => {
    const self: PeerInfo | null = meRef.current;
    if (self === null) {
      return;
    }
    isHoldingRef.current = true;
    if (speakerIdRef.current !== null) {
      return;
    }
    if (self.role === "dispatch") {
      grantFloor(self.id);
    } else {
      sendToDispatch({ type: "talk-request" });
    }
  };

  const stopTalking = (): void => {
    isHoldingRef.current = false;
    if (meRef.current !== null && speakerIdRef.current === meRef.current.id) {
      releaseFloor();
    }
  };

  const speakerInRoster: PeerInfo | undefined = roster.find(
    (rosterPeer: PeerInfo): boolean => rosterPeer.id === speakerId,
  );
  const speaker: PeerInfo | null = speakerInRoster === undefined ? null : speakerInRoster;
  const isTalking: boolean = me !== null && speakerId === me.id;

  return {
    status,
    errorMessage,
    me,
    roster,
    shiftLog,
    hearingCount,
    speaker,
    isTalking,
    feed,
    join,
    leave,
    startTalking,
    stopTalking,
    submitTranscript,
  };
};
