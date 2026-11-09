import { cn } from "@/lib/cn";

import type { JSX } from "react";
import type { Role } from "@/lib/types";

interface RoleCardProps {
  role: Role;
  isSelected: boolean;
  onSelect: (role: Role) => void;
}

const ROLE_DETAILS: Record<Role, { icon: string; label: string; description: string }> = {
  member: { icon: "🧑‍⚕️", label: "Member", description: "Talk with your team" },
  dispatch: { icon: "🩺", label: "Dispatch", description: "Coordinate the channel" },
};

// One of the two big role choices on the join screen (behaves as a radio button).
export const RoleCard = ({ role, isSelected, onSelect }: RoleCardProps): JSX.Element => {
  const { icon, label, description } = ROLE_DETAILS[role];
  const className: string = cn(
    "flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-colors",
    {
      "border-orange-500 bg-orange-500/10": isSelected,
      "border-zinc-700 hover:border-zinc-500": !isSelected,
    },
  );

  const handleClick = (): void => {
    onSelect(role);
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={label}
      className={className}
      onClick={handleClick}
    >
      <span className="text-3xl">{icon}</span>
      <span className="font-bold">{label}</span>
      <span className="text-xs text-zinc-400">{description}</span>
    </button>
  );
};
