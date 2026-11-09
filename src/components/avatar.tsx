import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { PeerInfo } from "@/lib/types";

interface AvatarProps {
  peer: PeerInfo;
  isSpeaking: boolean;
}

const initials = (name: string): string =>
  name
    .split(" ")
    .filter((word: string): boolean => word !== "")
    .slice(0, 2)
    .map((word: string): string => word[0].toUpperCase())
    .join("");

export const Avatar = ({ peer, isSpeaking }: AvatarProps): JSX.Element => {
  const isDispatch: boolean = peer.role === "dispatch";
  const label: string = isDispatch ? `${peer.name} (Dispatch)` : peer.name;
  const className: string = cn(
    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-offset-2 ring-offset-zinc-950 transition-shadow",
    {
      "bg-orange-600 text-white": isDispatch,
      "bg-zinc-700 text-zinc-100": !isDispatch,
      "ring-2 ring-green-400": isSpeaking,
    },
  );

  return (
    <li className={className} title={label} aria-label={label}>
      {initials(peer.name)}
    </li>
  );
};
