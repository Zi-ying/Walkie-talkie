import Peer from "peerjs";

import { generateId } from "./ids";

import type { PeerError, PeerErrorType } from "peerjs";

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
