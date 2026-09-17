import type { ReactNode } from "react";

/** A text button that shows or hides what follows it, marked ▸ closed and ▾ open. */
export default function DisclosureToggle({
  expanded,
  onToggle,
  className = "",
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className={`cursor-pointer text-left ${className}`}
    >
      <span aria-hidden="true">{expanded ? "▾ " : "▸ "}</span>
      {children}
    </button>
  );
}
