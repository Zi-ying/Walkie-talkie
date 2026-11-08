import type { JSX } from "react";
import type { PeerInfo } from "@/lib/types";

interface RosterItemProps {
  peer: PeerInfo;
  isMe: boolean;
  isSpeaking: boolean;
}

// One person in Dispatch's team list.
export const RosterItem = ({ peer, isMe, isSpeaking }: RosterItemProps): JSX.Element => {
  const icon: string = peer.role === "dispatch" ? "🎧" : "👷";

  return (
    <li className="flex items-center gap-2">
      <span className="size-2 rounded-full bg-green-400" aria-hidden="true" />
      <span>{icon}</span>
      <span>{peer.name}</span>
      {isMe && <span className="text-zinc-500">(you)</span>}
      {isSpeaking && <span className="ml-auto text-xs text-green-400">talking</span>}
    </li>
  );
};
