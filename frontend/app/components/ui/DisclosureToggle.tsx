import type { ReactNode } from "react";

/**
 * A text button that shows or hides what follows it, marked ▸ closed and ▾
 * open. The mark takes one spacing step, so what opens under it, indented a
 * step (`pl-4`), lines its own marks up under these words.
 */
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
      className={`text-left ${className}`}
    >
      <span aria-hidden="true" className="inline-block w-4">
        {expanded ? "▾" : "▸"}
      </span>
      {children}
    </button>
  );
}
