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

const CLOSE_TIMEOUT_MS: number = 1000;

const DISCONNECTED_GRACE_MS: number = 5000;

const LOCAL_SERVER_PORT: number = 9000;

export const memberPeerId = (channel: string): string =>
  `wt-${channel}-${generateId()}`;

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

export const parseMessage = (data: unknown): WireMessage | null => {
  const result: ZodSafeParseResult<WireMessage> = WireMessageSchema.safeParse(data);
  return result.success ? result.data : null;
};

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
