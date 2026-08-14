'use client';

import { useEffect, useState } from 'react';
import { transitionMs } from '@/app/lib/viewTransition';

/**
 * True for one transition's length, immediately after a load finishes.
 *
 * The calendar's events fade in when they arrive, and "arrive" has to mean
 * *arrive* — FullCalendar rebuilds its event elements whenever the array it's
 * given changes, so an animation attached to those elements re-fires on every
 * interaction that adds or removes one. Folding the fake events away flashed
 * every real event on the grid; deciding about one flashed all the undecided
 * ones. Things that hadn't moved appeared to blink, which is the opposite of
 * what the fade was for.
 *
 * So the animation is gated on a class that is only present in the window where
 * events genuinely turned up, and this is that window.
 *
 * ## Why the state is adjusted during render
 *
 * The class has to be in the same commit as the elements it animates. Setting it
 * from an effect would apply it a paint *after* they appeared, so they would show
 * up solid and then jump to transparent to fade back in — a worse flash than the
 * one this fixes. Adjusting state during render is React's own answer to
 * "derive state from a prop change": the component re-renders before anything is
 * committed, so the class and the elements land together.
 */
export function useArrival(loading: boolean): boolean {
  const [wasLoading, setWasLoading] = useState(loading);
  const [arriving, setArriving] = useState(false);

  if (wasLoading !== loading) {
    setWasLoading(loading);
    // Only the loading → loaded edge. Going the other way there is nothing on
    // screen to animate.
    setArriving(!loading);
  }

  useEffect(() => {
    if (!arriving) return;
    const done = window.setTimeout(() => setArriving(false), transitionMs());
    return () => window.clearTimeout(done);
  }, [arriving]);

  return arriving;
}
