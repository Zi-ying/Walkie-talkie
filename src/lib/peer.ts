import { Peer } from "peerjs";

import { generateId } from "@/lib/ids";
import { WireMessageSchema } from "@/lib/types";

import type {
  DataConnection,
  MediaConnection,
  PeerError,
  PeerErrorType,
  PeerJSOption,
} from "peerjs";
import type { ZodSafeParseResult } from "zod";
import type { WireMessage } from "@/lib/types";

// How long to wait for a flushed close before giving up and destroying anyway.
const CLOSE_TIMEOUT_MS: number = 1000;

// How long a connection may stay "disconnected" before we treat the other side as gone.
const DISCONNECTED_GRACE_MS: number = 5000;

// Port of the local PeerJS server (`yarn peer:local`), when one is used.
const LOCAL_SERVER_PORT: number = 9000;

// Members get a random id on the channel; dispatch uses dispatchPeerId() from ./types.
export const memberPeerId = (channel: string): string =>
  `wt-${channel}-${generateId()}`;

// Which signaling server to use. By default the free PeerJS cloud server; set VITE_PEERJS_HOST
// (and VITE_PEERJS_PORT) to use a local one instead, e.g. `yarn peer:local` (the e2e tests do this).
const signalingServerOptions = (): PeerJSOption => {
  const host: string | undefined = import.meta.env.VITE_PEERJS_HOST;
  if (host === undefined || host === "") {
    return {};
  }
  const port: string | undefined = import.meta.env.VITE_PEERJS_PORT;
  return {
    host,
    port: port === undefined ? LOCAL_SERVER_PORT : Number(port),
    path: "/",
    secure: false,
  };
};

// Connects to the signaling server (it only introduces peers, voice never goes through it)
// and resolves once our id is reserved.
export const createPeer = (id: string): Promise<Peer> =>
  new Promise<Peer>(
    (resolve: (peer: Peer) => void, reject: (reason: Error) => void): void => {
      const peer: Peer = new Peer(id, signalingServerOptions());
      peer.on("open", (): void => resolve(peer));
      peer.on("error", (error: PeerError<`${PeerErrorType}`>): void => {
        if (error.type === "unavailable-id") {
          reject(new Error("This id is already taken on this channel."));
        } else {
          reject(error);
        }
      });
    },
  );

// If we lose the PeerJS server (e.g. a throttled background tab), reconnect with the same id.
// destroy() also emits "disconnected" (before `peer.destroyed` becomes true),
// so the caller tells us when the disconnect was on purpose.
export const keepConnectedToServer = (
  peer: Peer,
  isLeavingOnPurpose: () => boolean,
): void => {
  peer.on("disconnected", (): void => {
    if (!isLeavingOnPurpose()) {
      peer.reconnect();
    }
  });
};

// Receiving side: answer every incoming call with our mic, and hand back the caller's audio.
export const answerCalls = (
  peer: Peer,
  localStream: MediaStream,
  onRemoteStream: (remotePeerId: string, stream: MediaStream) => void,
): void => {
  peer.on("call", (call: MediaConnection): void => {
    call.answer(localStream);
    call.on("stream", (stream: MediaStream): void =>
      onRemoteStream(call.peer, stream),
    );
  });
};

// Calling side: send our mic to `remoteId`, and hand back their audio once they answer.
export const callPeer = (
  peer: Peer,
  remoteId: string,
  localStream: MediaStream,
  onRemoteStream: (remotePeerId: string, stream: MediaStream) => void,
): MediaConnection => {
  const call: MediaConnection = peer.call(remoteId, localStream);
  call.on("stream", (stream: MediaStream): void =>
    onRemoteStream(remoteId, stream),
  );
  return call;
};

// PeerJS only closes a connection when the network state becomes "failed" or "closed".
// A closed tab usually leaves it "disconnected", which can last a long time, so the other side
// would never notice. "disconnected" can also be a short network blip, so we wait a little first.
// Closing fires the connection's "close" event, so the normal "someone left" handling runs.
export const closeWhenUnreachable = (connection: DataConnection): void => {
  let graceTimer: number | null = null;
  connection.on("iceStateChanged", (state: RTCIceConnectionState): void => {
    if (graceTimer !== null) {
      window.clearTimeout(graceTimer);
      graceTimer = null;
    }
    if (state === "disconnected") {
      graceTimer = window.setTimeout((): void => connection.close(), DISCONNECTED_GRACE_MS);
    }
  });
};

export const sendMessage = (
  connection: DataConnection,
  message: WireMessage,
): void => {
  connection.send(message);
};

// Data arrives as `unknown`: zod checks it really is one of our messages. Anything else is ignored.
export const parseMessage = (data: unknown): WireMessage | null => {
  const result: ZodSafeParseResult<WireMessage> = WireMessageSchema.safeParse(data);
  return result.success ? result.data : null;
};

// Sends a last message, then closes with { flush: true } so the message is delivered first.
// Resolves when the connection is closed (or after a timeout if the other side is gone).
export const sendAndClose = (
  connection: DataConnection,
  message: WireMessage,
): Promise<void> =>
  new Promise<void>((resolve: () => void): void => {
    const timeout: number = window.setTimeout(resolve, CLOSE_TIMEOUT_MS);
    connection.on("close", (): void => {
      window.clearTimeout(timeout);
      resolve();
    });
    sendMessage(connection, message);
    connection.close({ flush: true });
  });
