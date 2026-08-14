import { prefersReducedMotion, transitionMs } from '@/app/lib/viewTransition';

/** The class the CSS fades out; see `.review-calendar .is-leaving`. */
export const LEAVING_CLASS = 'is-leaving';

/**
 * Fade something out, *then* do the thing that removes it.
 *
 * Everything else on this page animates in CSS, and an element leaving the DOM
 * is the one case CSS cannot express on its own: by the time React has removed
 * the node there is nothing left to animate, so an event you decided was fake
 * simply blinked out while its neighbours had all faded in politely.
 *
 * A view transition would be the obvious tool and isn't available here. It
 * requires the DOM to change inside its callback, and these updates go through
 * the query cache — TanStack's `onMutate` runs a microtask after `mutate()`, so
 * `flushSync` has nothing to flush and the browser tweens the page against
 * itself. (The task pills can use one because their state is local.)
 *
 * So: mark the elements, wait exactly as long as the CSS takes, then update.
 * The cost is real and is the point — the state change lands a beat *after* the
 * click, because the thing is still on screen while it leaves. `pointer-events`
 * is off during the fade, so a second click can't land on an element whose state
 * is already spoken for.
 *
 * Falls straight through when there is nothing to fade, or when the reader asked
 * for less motion, or on the server.
 */
export function leaveThenUpdate(elements: Iterable<Element>, update: () => void): void {
  if (typeof window === 'undefined' || prefersReducedMotion()) {
    update();
    return;
  }

  const leaving = [...elements];
  if (leaving.length === 0) {
    update();
    return;
  }

  for (const element of leaving) element.classList.add(LEAVING_CLASS);
  window.setTimeout(update, transitionMs());
}
