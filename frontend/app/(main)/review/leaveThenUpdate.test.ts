import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { leaveThenUpdate, LEAVING_CLASS } from './leaveThenUpdate';

/**
 * The one animation on this page that JS has to be involved in.
 *
 * Everything else fades or moves in CSS. An element *leaving* the DOM can't:
 * once React has removed the node there is nothing left to animate, so the
 * update has to wait for the fade rather than the other way round. The two
 * things worth pinning are that it does wait, and that it never swallows the
 * update — a fade that failed to fire must not take the decision with it.
 */

const stubMotion = (reduced: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia
  );
};

beforeEach(() => {
  vi.useFakeTimers();
  stubMotion(false);
  // jsdom computes no value for a custom property that nothing declares, so
  // `transitionMs` falls back — which is exactly the path a browser takes if the
  // token is ever removed, and the assertions below use that number.
  document.documentElement.style.setProperty('--transition-time', '450ms');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('leaveThenUpdate', () => {
  it('marks the elements, then updates once the fade is over', () => {
    const element = document.createElement('div');
    const update = vi.fn();

    leaveThenUpdate([element], update);

    expect(element.classList.contains(LEAVING_CLASS)).toBe(true);
    // Still on screen, and the decision hasn't landed yet. This lag is the
    // feature: the thing is visible while it leaves.
    expect(update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(450);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('fades every element it is given', () => {
    // Folding the ignored events away removes several at once; one of them
    // fading while the rest blinked would be worse than none of them fading.
    const elements = [0, 1, 2].map(() => document.createElement('div'));

    leaveThenUpdate(elements, vi.fn());

    expect(elements.every((el) => el.classList.contains(LEAVING_CLASS))).toBe(true);
  });

  it('updates immediately when there is nothing to fade', () => {
    // The ordinary case: most decisions repaint the event in place rather than
    // removing it, and waiting 450ms to repaint would be a bug, not a flourish.
    const update = vi.fn();

    leaveThenUpdate([], update);

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('updates immediately when the reader asked for less motion', () => {
    stubMotion(true);
    const element = document.createElement('div');
    const update = vi.fn();

    leaveThenUpdate([element], update);

    expect(update).toHaveBeenCalledTimes(1);
    expect(element.classList.contains(LEAVING_CLASS)).toBe(false);
  });
});
