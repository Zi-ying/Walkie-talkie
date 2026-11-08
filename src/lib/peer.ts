import { Peer } from "peerjs";

import { generateId } from "./ids";

import type { MediaConnection, PeerError, PeerErrorType } from "peerjs";

// Members get a random id on the channel; dispatch uses dispatchPeerId() from ./types.
export const memberPeerId = (channel: string): string =>
  `wt-${channel}-${generateId()}`;

// Connects to the PeerJS cloud server (signaling only, voice never goes through it)
// and resolves once our id is reserved.
export const createPeer = (id: string): Promise<Peer> =>
  new Promise<Peer>(
    (resolve: (peer: Peer) => void, reject: (reason: Error) => void): void => {
      const peer: Peer = new Peer(id);
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
  onRemoteStream: (stream: MediaStream) => void,
): void => {
  peer.on("call", (call: MediaConnection): void => {
    call.answer(localStream);
    call.on("stream", onRemoteStream);
  });
};

// Calling side: send our mic to `remoteId`, and hand back their audio once they answer.
export const callPeer = (
  peer: Peer,
  remoteId: string,
  localStream: MediaStream,
  onRemoteStream: (stream: MediaStream) => void,
): MediaConnection => {
  const call: MediaConnection = peer.call(remoteId, localStream);
  call.on("stream", onRemoteStream);
  return call;
};
