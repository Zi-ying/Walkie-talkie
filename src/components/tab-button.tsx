import { cn } from "@/lib/cn";

import type { JSX } from "react";

export type DispatchTab = "team" | "talk" | "notes";

export type TabDetails = {
  tab: DispatchTab;
  label: string;
  icon: string;
};

interface TabButtonProps {
  details: TabDetails;
  activeTab: DispatchTab;
  onSelect: (tab: DispatchTab) => void;
}

export const TabButton = ({ details, activeTab, onSelect }: TabButtonProps): JSX.Element => {
  const { tab, label, icon } = details;
  const isActive: boolean = tab === activeTab;
  const className: string = cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-xs", {
    "text-orange-400": isActive,
    "text-zinc-400": !isActive,
  });

  const handleClick = (): void => {
    onSelect(tab);
  };

  return (
    <button type="button" role="tab" aria-selected={isActive} className={className} onClick={handleClick}>
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
};
