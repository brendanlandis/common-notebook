import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArrival } from './useArrival';

/**
 * The window in which the calendar's events are allowed to fade in.
 *
 * It exists because FullCalendar rebuilds its event elements whenever the array
 * it's handed changes, so an animation on those elements fires on every
 * interaction rather than on arrival: folding the fake events away flashed every
 * real event on the grid, and deciding about one flashed all the undecided ones.
 * Things that had not moved appeared to blink.
 */

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.style.setProperty('--transition-time', '450ms');
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.style.removeProperty('--transition-time');
});

describe('useArrival', () => {
  it('opens on the loading → loaded edge and closes again', () => {
    const { result, rerender } = renderHook(({ loading }) => useArrival(loading), {
      initialProps: { loading: true },
    });

    expect(result.current).toBe(false);

    rerender({ loading: false });
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(450));
    expect(result.current).toBe(false);
  });

  it('stays shut while a load is in progress', () => {
    // Going the other way there is nothing on screen to animate.
    const { result, rerender } = renderHook(({ loading }) => useArrival(loading), {
      initialProps: { loading: false },
    });

    rerender({ loading: true });

    expect(result.current).toBe(false);
  });

  it('stays shut through re-renders that change nothing', () => {
    // This is the actual bug: every one of these is an interaction that rebuilds
    // the grid — a decision, a fold, a refetch — and none of them is an arrival.
    const { result, rerender } = renderHook(({ loading }) => useArrival(loading), {
      initialProps: { loading: true },
    });

    rerender({ loading: false });
    act(() => vi.advanceTimersByTime(450));

    for (let i = 0; i < 3; i++) {
      rerender({ loading: false });
      expect(result.current).toBe(false);
    }
  });

  it('opens again when a second load finishes', () => {
    // Switching cycles refetches, and those events are arriving too.
    const { result, rerender } = renderHook(({ loading }) => useArrival(loading), {
      initialProps: { loading: true },
    });

    rerender({ loading: false });
    act(() => vi.advanceTimersByTime(450));
    rerender({ loading: true });
    rerender({ loading: false });

    expect(result.current).toBe(true);
  });
});
