import type { ComponentProps } from "react";

/*
 * The app's text button: daisyUI's `btn`, outlined in the text color on the
 * page's paper. No shadow, and nearly square corners, to sit with the square
 * fields in `FormControls`. Like every button here, it doesn't change on hover
 * or press; the pointer says it can be pressed (screen.css). daisyUI's own
 * hover colors lose to the ones set here, and its half-pixel press nudge is
 * turned off.
 *
 * `small` is for a button inside a row of content (removing a calendar), where
 * the full-size padding would crowd the text beside it. Full size is body text,
 * small is the scale's small step.
 *
 * No margin of its own: where one is centered or pushed aside, the caller says so.
 */
const BUTTON =
  "btn rounded-[0.2rem] border border-base-content bg-base-100 py-[0.3rem] text-base-content shadow-none active:translate-none";

export default function Button({
  small = false,
  className = "",
  type = "button",
  ...props
}: { small?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={`${BUTTON} ${small ? "btn-sm px-3 text-small" : "px-8 text-body"} ${className}`}
      {...props}
    />
  );
}
