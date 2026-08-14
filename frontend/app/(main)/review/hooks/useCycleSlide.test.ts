import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCycleSlide } from './useCycleSlide';

/**
 * The out-swap-in gesture behind the cycle switch.
 *
 * The thing worth pinning is the *order*: the period must change while the grid
 * is off screen, never while it's visible. That's the whole reason the swap is a
 * callback rather than something the caller does before or after.
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
  document.documentElement.style.setProperty('--transition-time', '450ms');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--transition-time');
});

describe('useCycleSlide', () => {
  it('slides out, swaps at the halfway point, then slides in', () => {
    const swap = vi.fn();
    const { result } = renderHook(() => useCycleSlide());

    act(() => result.current.run('forward', swap));
    expect(result.current.phase).toBe('cycle-out-forward');
    // Nothing has changed yet: the grid you're looking at is still the old one.
    expect(swap).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(225));
    expect(swap).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('cycle-in-forward');

    act(() => vi.advanceTimersByTime(225));
    expect(result.current.phase).toBeNull();
  });

  it('runs the other way round going back', () => {
    const { result } = renderHook(() => useCycleSlide());

    act(() => result.current.run('back', vi.fn()));
    expect(result.current.phase).toBe('cycle-out-back');

    act(() => vi.advanceTimersByTime(225));
    expect(result.current.phase).toBe('cycle-in-back');
  });

  it('restarts rather than queueing when toggled mid-slide', () => {
    // Toggling twice quickly is exactly how this got reported. The first
    // gesture's pending halves would otherwise swap the period back underneath
    // the second one.
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useCycleSlide());

    act(() => result.current.run('forward', first));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.run('back', second));

    expect(result.current.phase).toBe('cycle-out-back');

    act(() => vi.advanceTimersByTime(225));
    expect(second).toHaveBeenCalledTimes(1);
    // The abandoned gesture never fires.
    expect(first).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(225));
    expect(result.current.phase).toBeNull();
  });

  it('swaps immediately when the reader asked for less motion', () => {
    stubMotion(true);
    const swap = vi.fn();
    const { result } = renderHook(() => useCycleSlide());

    act(() => result.current.run('forward', swap));

    expect(swap).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBeNull();
  });

  it('drops pending timers when the page goes away', () => {
    // Otherwise a swap fires into an unmounted component.
    const swap = vi.fn();
    const { result, unmount } = renderHook(() => useCycleSlide());

    act(() => result.current.run('forward', swap));
    unmount();
    act(() => vi.advanceTimersByTime(500));

    expect(swap).not.toHaveBeenCalled();
  });
});
