import type { ComponentProps, ReactNode } from "react";

/*
 * The app's form controls: daisyUI's input, select and checkbox, with square
 * corners and a full-strength border in the text color, which is how the app's
 * fields have always looked. Spread react-hook-form's `register()` straight in;
 * the ref reaches the element.
 */

// Body size, not daisyUI's 12–14px: on the type scale, and at 16px or more so
// Safari on an iPhone doesn't zoom the page when a field is tapped.
const FIELD = "rounded-none border-base-content text-body";

/** Full width by default; `fullWidth={false}` sizes a control to its content. */
type Sizing = { fullWidth?: boolean };
const width = (fullWidth: boolean) => (fullWidth ? "w-full" : "w-auto");

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
        className={hideLabel ? "sr-only" : "mb-1 block text-small"}
      >
        {label}
      </label>
      {children}
      {error && <span className="mt-1 block text-small italic">{error}</span>}
    </div>
  );
}

export function Input({
  className = "",
  fullWidth = true,
  ...props
}: ComponentProps<"input"> & Sizing) {
  return (
    <input className={`input ${FIELD} ${width(fullWidth)} ${className}`} {...props} />
  );
}

export function Select({
  className = "",
  fullWidth = true,
  ...props
}: ComponentProps<"select"> & Sizing) {
  return (
    <select className={`select ${FIELD} ${width(fullWidth)} ${className}`} {...props} />
  );
}

/*
 * Checkboxes and switches move at the site's speed rather than daisyUI's, which
 * is about half of it; see --transition-time.
 */
const MOTION =
  "[transition-duration:var(--transition-time)] before:[transition-duration:var(--transition-time)]";

/** The box on its own, for rows that build their own label. */
export function CheckboxInput({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={`checkbox rounded-none border-base-content before:bg-base-content ${MOTION} ${className}`}
      {...props}
    />
  );
}

/**
 * A switch: a knob that slides along a track, so both are round whatever the
 * app's square fields do.
 */
export function Toggle({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={`toggle rounded-full before:rounded-full ${MOTION} ${className}`}
      {...props}
    />
  );
}

/** A checkbox with its label beside it; clicking the words ticks it. */
export function Checkbox({
  children,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { children?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 ${className}`}>
      <CheckboxInput {...props} />
      {children}
    </label>
  );
}
