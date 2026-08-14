import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PracticeClock, { formatElapsed } from './PracticeClock';
import type { PracticeSegment } from '@/app/lib/practiceSession';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatElapsed', () => {
  it.each([
    [0, '0:00'],
    [1_000, '0:01'],
    [61_000, '1:01'],
    [59 * 60_000, '59:00'],
    [60 * 60_000, '1:00:00'],
    [(60 * 60 + 5 * 60 + 3) * 1000, '1:05:03'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });

  it('never shows a negative clock', () => {
    expect(formatElapsed(-5000)).toBe('0:00');
  });
});

describe('PracticeClock', () => {
  it('shows practiced time, not wall time', () => {
    // The whole reason this replaced a start-time timer: an hour of wall clock,
    // twenty minutes of it practiced.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T15:00:00.000Z'));

    const segments: PracticeSegment[] = [
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' },
    ];
    render(<PracticeClock segments={segments} />);

    expect(screen.getByRole('timer').textContent).toBe('20:00');
  });

  it('counts the open stretch up to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T15:00:00.000Z'));

    const segments: PracticeSegment[] = [
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' },
      { start: '2026-08-14T14:55:00.000Z', stop: null },
    ];
    render(<PracticeClock segments={segments} />);

    expect(screen.getByRole('timer').textContent).toBe('25:00');
  });

  it('ticks while running', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T15:00:00.000Z'));

    render(<PracticeClock segments={[{ start: '2026-08-14T14:59:00.000Z', stop: null }]} />);
    expect(screen.getByRole('timer').textContent).toBe('1:00');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('timer').textContent).toBe('1:02');
  });

  it('does not tick while paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T15:00:00.000Z'));

    render(
      <PracticeClock
        segments={[{ start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' }]}
      />
    );
    expect(screen.getByRole('timer').textContent).toBe('20:00');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('timer').textContent).toBe('20:00');
  });

  it('reads zero for a session with no segments', () => {
    render(<PracticeClock segments={[]} />);
    expect(screen.getByRole('timer').textContent).toBe('0:00');
  });
});
