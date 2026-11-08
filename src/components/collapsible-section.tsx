import type { JSX, ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
}

// A folded section: click the title (with its arrow) to show the content, which scrolls when long.
export const CollapsibleSection = ({ title, children }: CollapsibleSectionProps): JSX.Element => (
  <details className="group">
    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-300">
      <span className="transition-transform group-open:rotate-90" aria-hidden="true">
        ▸
      </span>
      {title}
    </summary>
    <div className="mt-3 max-h-64 overflow-y-auto pr-1">{children}</div>
  </details>
);
