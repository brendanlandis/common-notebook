/*
 * A daisyUI tooltip below its element, in the app's colors: the success green in
 * the light theme and the accent in the dark one, each with its own foreground.
 * Put it on anything with a `data-tip`.
 *
 * Its bubble moves sideways by `--tip-shift` to stay on screen (see
 * `fitTooltip`). That's the `translate` property, which daisyUI doesn't
 * animate, so the bubble is already in place as it fades in.
 */
export const TOOLTIP = [
  "tooltip tooltip-bottom",
  "[--tt-bg:var(--color-success)] before:text-success-content",
  "dim:[--tt-bg:var(--color-accent)] dim:before:text-accent-content",
  "before:[translate:var(--tip-shift,0)]",
].join(" ");

/** Room kept between a bubble and the edge it would run past: the page's gutter. */
const EDGE = 16;

/** Half the width of daisyUI's tail, which has to stay under the bubble. */
const TAIL_HALF = 5;

/**
 * How far to move a bubble sideways to keep it between `left` and `right`,
 * `EDGE` short of each. It starts centered on `center`, where its tail stays,
 * and never moves so far that the tail is left outside it: `keep` is how far in
 * from the bubble's edge the tail's middle has to be.
 */
export function bubbleShift({
  center,
  width,
  left,
  right,
  keep,
}: {
  center: number;
  width: number;
  left: number;
  right: number;
  keep: number;
}): number {
  const start = center - width / 2;
  const end = center + width / 2;
  let shift = 0;
  if (end > right - EDGE) shift = right - EDGE - end;
  // Too wide for the room: keep its start in view, where reading begins.
  if (start + shift < left + EDGE) shift = left + EDGE - start;
  const reach = Math.max(0, width / 2 - keep);
  return Math.min(reach, Math.max(-reach, shift));
}

/**
 * The part of the window a bubble can be seen in: the window itself, less
 * anything around the element that clips sideways (the header, a drawer).
 */
function visibleSpan(el: Element): [number, number] {
  let left = 0;
  let right = document.documentElement.clientWidth;
  for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
    const style = getComputedStyle(box);
    if (style.overflowX !== "visible") {
      const inner = box.getBoundingClientRect().left + box.clientLeft;
      left = Math.max(left, inner);
      right = Math.min(right, inner + box.clientWidth);
    }
    // Nothing further out clips something fixed to the window.
    if (style.position === "fixed") break;
  }
  return [left, right];
}

/**
 * Moves a tooltip's bubble (daisyUI's `::before`) sideways into view, leaving
 * its tail (`::after`) pointing at the element. Run just before the tooltip
 * shows; `TooltipsInView` does, for every tooltip.
 *
 * A hidden bubble is still laid out, where it would show or where it last
 * showed, and one fitted while its element slid past the pointer can be off
 * to the side. Near the edge of something that scrolls, that makes it scroll
 * sideways, so the header and the main menu clip sideways.
 */
export function fitTooltip(el: HTMLElement) {
  const bubble = getComputedStyle(el, "::before");
  const width = parseFloat(bubble.width);
  if (!width) return;
  const box = el.getBoundingClientRect();
  const [left, right] = visibleSpan(el);
  const shift = bubbleShift({
    center: box.left + box.width / 2,
    width,
    left,
    right,
    keep: TAIL_HALF + (parseFloat(bubble.borderBottomLeftRadius) || 0),
  });
  if (shift) el.style.setProperty("--tip-shift", `${shift}px`);
  else el.style.removeProperty("--tip-shift");
}
