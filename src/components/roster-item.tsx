import type { JSX } from "react";
import type { PeerInfo } from "@/lib/types";

interface RosterItemProps {
  peer: PeerInfo;
  isMe: boolean;
}

export const RosterItem = ({ peer, isMe }: RosterItemProps): JSX.Element => {
  const icon: string = peer.role === "dispatch" ? "🎧" : "👷";

  return (
    <li className="flex gap-1">
      <span>{icon}</span>
      <span>{peer.name}</span>
      {isMe && <span className="text-zinc-500">(you)</span>}
    </li>
  );
};
