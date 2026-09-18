/*
 * A daisyUI tooltip below its element, in the app's colors: the success green in
 * the light theme and the accent in the dark one, each with its own foreground.
 * Put it on anything with a `data-tip`.
 */
export const TOOLTIP = [
  "tooltip tooltip-bottom",
  "[--tt-bg:var(--color-success)] before:text-success-content",
  "dim:[--tt-bg:var(--color-accent)] dim:before:text-accent-content",
].join(" ");
