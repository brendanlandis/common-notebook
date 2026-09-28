import type { ComponentProps } from "react";
import { TrashIcon } from "@phosphor-icons/react";

/**
 * The app's delete control: a trash can that asks first. `question` is what
 * the are-you-sure dialog says, and `onDelete` runs only if it's answered yes.
 * Disabled, it dims as a row's drag handle does; a `title` can say why.
 * Callers name it with an `aria-label`, since the can is all it shows.
 */
export default function DeleteButton({
  question,
  onDelete,
  className = "",
  ...props
}: { question: string; onDelete: () => void } & Omit<
  ComponentProps<"button">,
  "onClick" | "type"
>) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center disabled:opacity-30 ${className}`}
      onClick={() => {
        if (confirm(question)) onDelete();
      }}
      {...props}
    >
      <TrashIcon size={20} aria-hidden="true" />
    </button>
  );
}
