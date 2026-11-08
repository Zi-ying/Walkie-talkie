import type { JSX } from "react";
import type { PeerInfo } from "@/lib/types";

interface RosterItemProps {
  peer: PeerInfo;
  isMe: boolean;
}

export const RosterItem = ({ peer, isMe }: RosterItemProps): JSX.Element => (
  <li>
    {peer.role === "dispatch" ? "🎧" : "👷"} {peer.name}
    {isMe && <span className="text-zinc-500"> (you)</span>}
  </li>
);
