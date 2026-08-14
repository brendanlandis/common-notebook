/**
 * Whether a DOM update should be wrapped in a view transition.
 *
 * The View Transitions API is the only way to animate an element that *moves
 * between two containers*: the browser snapshots the page before and after the
 * update and tweens each named element from where it was to where it landed. Any
 * hand-rolled version means measuring positions, cloning nodes, and animating
 * them in a layer above the page — a lot of code to reimplement something the
 * browser now does natively, and it goes wrong the moment the list reflows.
 *
 * Two reasons to skip it, and both fall back to the same plain, instant update:
 *
 * 1. **No support.** Chrome and Safari have it; Firefox is the laggard. This is
 *    presentation only, so the un-animated path is not a degraded experience,
 *    just a less pretty one.
 * 2. **`prefers-reduced-motion`.** Things flying across the screen is exactly
 *    what that setting is about, and honouring it in JS rather than by
 *    neutralising the animation in CSS means the browser never does the snapshot
 *    work at all.
 *
 * Exported separately from any call site so both branches can be tested; jsdom
 * implements neither API, so without the guard every component test that toggled
 * a selection would throw.
 */
export function canViewTransition(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (typeof document.startViewTransition !== 'function') return false;

  // `matchMedia` is absent in some test environments and older embedded
  // browsers; treat "can't ask" as "no preference expressed".
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return !reduced;
}
