import type { ComponentProps } from "react";
import { TrashIcon } from "@phosphor-icons/react";

/**
 * The app's delete control: a trash can that asks first. `question` is what
 * the are-you-sure dialog says, and `onDelete` runs only if it's answered yes.
 * Where the thing can't be deleted, `cannot` says why, and pressing the can
 * says that instead of asking: it looks the same either way, never dimmed.
 * Callers name it with an `aria-label`, since the can is all it shows.
 */
export default function DeleteButton({
  question,
  cannot,
  onDelete,
  className = "",
  ...props
}: { question: string; cannot?: string; onDelete: () => void } & Omit<
  ComponentProps<"button">,
  "onClick" | "type"
>) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center ${className}`}
      onClick={() => {
        if (cannot) alert(cannot);
        else if (confirm(question)) onDelete();
      }}
      {...props}
    >
      <TrashIcon size={20} aria-hidden="true" />
    </button>
  );
}
