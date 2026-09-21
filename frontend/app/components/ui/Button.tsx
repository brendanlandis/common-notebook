import type { ComponentProps } from "react";

/*
 * The app's text button: daisyUI's `btn`, outlined in the text color on the
 * page's paper, filling with the text color on hover or press. No shadow, and
 * nearly square corners, to sit with the square fields in `FormControls`.
 *
 * `small` is for a button inside a row of content (removing a calendar), where
 * the full-size padding would crowd the text beside it. Full size is body text,
 * small is the scale's small step.
 *
 * No margin of its own: where one is centered or pushed aside, the caller says so.
 */
const BUTTON = [
  "btn rounded-[0.2rem] border border-base-content bg-base-100 py-[0.3rem] text-base-content shadow-none",
  "hover:bg-base-content hover:text-base-100 active:bg-base-content active:text-base-100",
].join(" ");

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
