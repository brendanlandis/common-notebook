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
 *    what that setting is about, and honoring it in JS rather than by
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
  return !prefersReducedMotion();
}

/**
 * The reduced-motion half of the check above, on its own.
 *
 * An animation that is *only* a fade needs this and not the support check — a
 * browser without view transitions can still fade something out perfectly well,
 * and gating it on `canViewTransition` would deny Firefox an animation it is
 * entirely capable of.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  // `matchMedia` is absent in some test environments and older embedded
  // browsers; treat "can't ask" as "no preference expressed".
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Fallback for `--transition-time`, and the only place it's duplicated. */
const DEFAULT_TRANSITION_MS = 450;

/**
 * `--transition-time` in milliseconds.
 *
 * Read from the document rather than declared here, because the token in
 * `screen.css` is the site's one answer to "how fast does anything move" and a
 * second copy in JS would drift from it silently. Needed wherever an animation
 * has to *finish before* something else happens — a fade-out, where the element
 * is removed at the end — which is the one case CSS cannot express alone.
 */
export function transitionMs(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return DEFAULT_TRANSITION_MS;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--transition-time')
    .trim();
  // Authored as `450ms` or `.45s`; both are legal and both have shown up.
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return DEFAULT_TRANSITION_MS;
  return raw.endsWith('ms') ? value : value * 1000;
}
