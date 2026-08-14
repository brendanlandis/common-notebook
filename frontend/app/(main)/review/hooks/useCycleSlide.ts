'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, transitionMs } from '@/app/lib/viewTransition';

export type CycleDirection = 'forward' | 'back';

/**
 * Slide the grid out, swap the period, slide it back in.
 *
 * ## Why this isn't a view transition
 *
 * It was, and it didn't work — reliably enough to be reported as "it might work
 * the first time, but not if I toggle it a few times", which turned out to be
 * exactly right.
 *
 * Switching cycles sets off a second, *asynchronous* change: the review covering
 * the new period is fetched, and when it lands the selection is re-seeded, which
 * can remove the whole "this week" section and the ~50 pills inside it. Each of
 * those pills carries a `view-transition-name`. Measured in Firefox, that second
 * commit arrives around 76ms into a 450ms transition and the transition is over
 * nine milliseconds later — the browser abandons it when named elements vanish
 * underneath it. Chromium does the same; it only appeared to work when the
 * review query happened to be slow enough to land after the animation finished,
 * which is why a cold first toggle looked fine and every later one didn't.
 *
 * No amount of tuning fixes that, because the requirement is impossible: a view
 * transition needs the DOM to hold still for its whole duration, and this
 * interaction is defined by a second thing arriving from the network partway
 * through.
 *
 * A CSS animation on the live element has no such requirement. It animates what
 * is on screen, and nothing that happens elsewhere on the page can interrupt it.
 * The cost is that the outgoing and incoming grids can't overlap — they're the
 * same element — so the gesture is sequential: out, swap, in. Each half runs for
 * half of `--transition-time`, so the whole thing still takes as long as
 * everything else that moves in this app.
 */

/** The class on the calendar frame, or null when it's sitting still. */
export type CyclePhase = `cycle-${'out' | 'in'}-${CycleDirection}` | null;

export function useCycleSlide() {
  const [phase, setPhase] = useState<CyclePhase>(null);
  const timers = useRef<number[]>([]);

  const clear = () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  };

  useEffect(() => clear, []);

  /**
   * `swap` is whatever actually changes the period. It runs at the halfway
   * point, while the grid is off screen, so the change is never seen happening.
   */
  const run = useCallback((direction: CycleDirection, swap: () => void) => {
    // A second toggle mid-slide restarts the gesture rather than queueing
    // behind it; the pending halves of the last one would otherwise swap the
    // period back under it.
    clear();

    if (prefersReducedMotion()) {
      setPhase(null);
      swap();
      return;
    }

    const half = transitionMs() / 2;
    setPhase(`cycle-out-${direction}`);

    timers.current.push(
      window.setTimeout(() => {
        swap();
        setPhase(`cycle-in-${direction}`);
      }, half),
      window.setTimeout(() => setPhase(null), half * 2)
    );
  }, []);

  return { phase, run };
}
