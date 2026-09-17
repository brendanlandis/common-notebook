import type { ComponentProps, ReactNode } from "react";

/*
 * The app's form controls: daisyUI's input, select and checkbox, with square
 * corners and a full-strength border in the text color, which is how the app's
 * fields have always looked. Spread react-hook-form's `register()` straight in;
 * the ref reaches the element.
 */

const FIELD = "w-full rounded-none border-base-content";

/**
 * A control with its label. The label sits above it, or with `hideLabel` is
 * left to screen readers where a placeholder or the value already says what
 * the field is.
 */
export function Field({
  label,
  htmlFor,
  hideLabel = false,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  hideLabel?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      <label
        htmlFor={htmlFor}
        className={hideLabel ? "sr-only" : "mb-1 block text-sm"}
      >
        {label}
      </label>
      {children}
      {error && <span className="mt-1 block text-sm italic">{error}</span>}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`input ${FIELD} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`select ${FIELD} ${className}`} {...props} />;
}

/** A checkbox with its label beside it; clicking the words ticks it. */
export function Checkbox({
  children,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 ${className}`}>
      <input
        type="checkbox"
        className="checkbox rounded-none border-base-content"
        {...props}
      />
      {children}
    </label>
  );
}
