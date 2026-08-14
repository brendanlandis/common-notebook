import { describe, it, expect, afterEach, vi } from 'vitest';
import { computeReviewPeriod, defaultReviewMode, nextBoundary } from './reviewCycle';
import type { RecurrenceRule } from '../types/index';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * The cadence → period math.
 *
 * Only the clock is stubbed (via `vi.setSystemTime`); `parseDate`/`toISODate`
 * and the recurrence engine underneath are all real, so these assert the actual
 * calendar and astronomical arithmetic rather than a fixture of it. The suite is
 * run across the TZ matrix — a green run on one machine zone proves nothing here,
 * since every boundary is a wall-clock date derived from an instant.
 */

const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

function rule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    isRecurring: true,
    recurrenceType: 'weekly',
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    ...overrides,
  };
}

describe('computeReviewPeriod', () => {
  afterEach(() => vi.useRealTimers());

  const at = (iso: string) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(iso));
  };

  describe('weekly', () => {
    const weeklyMonday = rule({ recurrenceType: 'weekly', recurrenceDayOfWeek: 1 });

    it('plans the coming week from Sunday night', () => {
      // The case that motivated storing a range: it is Sunday evening, the week
      // starts Monday, and the review being written is for Monday–Sunday.
      at('2026-01-11T23:00:00-05:00'); // Sunday 11 Jan, 11pm in New York

      expect(computeReviewPeriod(weeklyMonday, EST, { mode: 'upcoming' })).toEqual({
        periodStart: '2026-01-12', // Monday
        periodEnd: '2026-01-18', // the following Sunday
      });
    });

    it('covers a whole week, not boundary-to-boundary', () => {
      at('2026-01-07T12:00:00-05:00'); // Wednesday

      const period = computeReviewPeriod(weeklyMonday, EST, { mode: 'upcoming' })!;

      expect(period).toEqual({ periodStart: '2026-01-12', periodEnd: '2026-01-18' });
      // Seven days inclusive — the end must not land on the next boundary.
      expect(period.periodEnd).not.toBe('2026-01-19');
    });

    it('covers only the rest of the week when re-run mid-cycle', () => {
      // "I should be able to conduct a weekly review for the rest of my week,
      // even though it's Thursday today."
      at('2026-01-08T12:00:00-05:00'); // Thursday 8 Jan

      expect(computeReviewPeriod(weeklyMonday, EST, { mode: 'remainder' })).toEqual({
        periodStart: '2026-01-08',
        periodEnd: '2026-01-11', // through Sunday
      });
    });

    it('respects the day boundary hour', () => {
      // 2am Monday is still "Sunday" under a 4am boundary, so the review being
      // planned is for the week starting *this* Monday, hours away.
      at('2026-01-12T02:00:00-05:00');

      expect(nextBoundary(weeklyMonday, EST)).toBe('2026-01-12');
    });
  });

  describe('biweekly', () => {
    const biweekly = rule({ recurrenceType: 'biweekly', recurrenceDayOfWeek: 1 });

    it('spans fourteen days from the anchor', () => {
      at('2026-01-07T12:00:00-05:00'); // Wednesday

      const period = computeReviewPeriod(biweekly, EST, {
        mode: 'upcoming',
        anchorDate: '2026-01-12',
      })!;

      expect(period.periodStart).toBe('2026-01-12');
      expect(period.periodEnd).toBe('2026-01-25'); // 14 days inclusive
    });

    it('treats an anchor still in the future as the next boundary', () => {
      // The task engine's biweekly branch is a do/while that always adds 14 —
      // right for "I just completed one", wrong for "when does the next cycle
      // begin". An anchor two weeks out must not become four.
      at('2026-01-07T12:00:00-05:00');

      expect(nextBoundary(biweekly, EST, '2026-01-19')).toBe('2026-01-19');
    });

    it('strides forward from an anchor in the past', () => {
      // Anchored last November, so the phase is preserved across many cycles
      // rather than resetting to the next Monday.
      at('2026-01-07T12:00:00-05:00');

      // 2025-11-03 + 14*5 = 2026-01-12.
      expect(nextBoundary(biweekly, EST, '2025-11-03')).toBe('2026-01-12');
    });

    it('returns null without an anchor, rather than guessing the phase', () => {
      // "Every other Monday" doesn't say which Monday. A task gets its phase
      // from the occurrence it just completed; a cadence has no completion, so
      // guessing would put the review on the wrong fortnight half the time.
      at('2026-01-07T12:00:00-05:00');

      expect(computeReviewPeriod(biweekly, EST, { mode: 'upcoming' })).toBeNull();
    });
  });

  describe('monthly', () => {
    it('runs from the nth of one month to the day before the next', () => {
      at('2026-01-07T12:00:00-05:00');

      expect(
        computeReviewPeriod(
          rule({ recurrenceType: 'monthly date', recurrenceDayOfMonth: 15 }),
          EST,
          { mode: 'upcoming' }
        )
      ).toEqual({ periodStart: '2026-01-15', periodEnd: '2026-02-14' });
    });

    it('handles the last weekday of the month', () => {
      // The cadence Brendan asked for by name, and the one whose arithmetic is
      // worth not reimplementing: last Friday of Jan 2026 is the 30th, of Feb
      // the 27th.
      at('2026-01-07T12:00:00-05:00');

      expect(
        computeReviewPeriod(
          rule({
            recurrenceType: 'monthly day',
            recurrenceWeekOfMonth: -1,
            recurrenceDayOfWeekMonthly: 5,
          }),
          EST,
          { mode: 'upcoming' }
        )
      ).toEqual({ periodStart: '2026-01-30', periodEnd: '2026-02-26' });
    });

    it('caps a 31st to the length of a short month', () => {
      at('2026-01-07T12:00:00-05:00');

      const period = computeReviewPeriod(
        rule({ recurrenceType: 'monthly date', recurrenceDayOfMonth: 31 }),
        EST,
        { mode: 'upcoming' }
      )!;

      expect(period.periodStart).toBe('2026-01-31');
      expect(period.periodEnd).toBe('2026-02-27'); // Feb 28 is the next boundary
    });
  });

  describe('astronomical cadences', () => {
    it('runs new moon to the day before the next new moon', () => {
      at('2026-01-07T12:00:00-05:00');

      const period = computeReviewPeriod(
        rule({ recurrenceType: 'new moon' }),
        EST,
        { mode: 'upcoming' }
      )!;

      // A synodic month is ~29.5 days, so the period is 29 or 30 days inclusive.
      const days =
        (Date.parse(`${period.periodEnd}T00:00:00Z`) -
          Date.parse(`${period.periodStart}T00:00:00Z`)) /
          86_400_000 +
        1;
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(30);
      expect(period.periodStart > '2026-01-07').toBe(true);
    });

    it('runs season to season', () => {
      at('2026-01-07T12:00:00-05:00');

      const period = computeReviewPeriod(
        rule({ recurrenceType: 'every season' }),
        EST,
        { mode: 'upcoming' }
      )!;

      // Spring equinox 2026 through the day before the summer solstice.
      expect(period.periodStart.startsWith('2026-03')).toBe(true);
      expect(period.periodEnd.startsWith('2026-06')).toBe(true);
    });
  });

  describe('no usable cadence', () => {
    it('returns null when not recurring', () => {
      expect(
        computeReviewPeriod(rule({ isRecurring: false }), EST, { mode: 'upcoming' })
      ).toBeNull();
    });

    it('returns null for recurrenceType none', () => {
      expect(
        computeReviewPeriod(rule({ recurrenceType: 'none' }), EST, { mode: 'upcoming' })
      ).toBeNull();
    });

    it('returns null when a required field is missing', () => {
      // Rather than guessing a period — a guess would be silently written onto a
      // real review and be wrong for a whole cycle.
      expect(
        computeReviewPeriod(
          rule({ recurrenceType: 'weekly', recurrenceDayOfWeek: null }),
          EST,
          { mode: 'upcoming' }
        )
      ).toBeNull();
    });
  });

  describe('period integrity', () => {
    it('never returns an end before its start, for any supported cadence', () => {
      at('2026-01-07T12:00:00-05:00');

      const cadences: RecurrenceRule[] = [
        rule({ recurrenceType: 'weekly', recurrenceDayOfWeek: 3 }),
        rule({ recurrenceType: 'biweekly', recurrenceDayOfWeek: 3 }),
        rule({ recurrenceType: 'monthly date', recurrenceDayOfMonth: 1 }),
        rule({
          recurrenceType: 'monthly day',
          recurrenceWeekOfMonth: 2,
          recurrenceDayOfWeekMonthly: 4,
        }),
        rule({ recurrenceType: 'full moon' }),
        rule({ recurrenceType: 'new moon' }),
        rule({ recurrenceType: 'every season' }),
      ];

      for (const cadence of cadences) {
        for (const mode of ['upcoming', 'remainder'] as const) {
          const period = computeReviewPeriod(cadence, EST, { mode, anchorDate: '2026-01-12' });
          expect(period, `${cadence.recurrenceType} / ${mode}`).not.toBeNull();
          expect(
            period!.periodStart <= period!.periodEnd,
            `${cadence.recurrenceType} / ${mode}: ${period!.periodStart}..${period!.periodEnd}`
          ).toBe(true);
        }
      }
    });
  });
});

describe('defaultReviewMode', () => {
  afterEach(() => vi.useRealTimers());

  const at = (iso: string) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(iso));
  };

  const weeklyMonday = rule({ recurrenceType: 'weekly', recurrenceDayOfWeek: 1 });

  it('opens on the cycle you are in', () => {
    at('2026-01-07T12:00:00-05:00'); // Wednesday, mid-week

    expect(defaultReviewMode(weeklyMonday, EST)).toBe('remainder');
  });

  it('opens on the next one when tomorrow starts it', () => {
    // Sunday night, planning Monday. "This week" would offer a review of the one
    // day left in it.
    at('2026-01-11T21:00:00-05:00');

    expect(defaultReviewMode(weeklyMonday, EST)).toBe('upcoming');
  });

  it('is back to this cycle on the boundary day itself', () => {
    // Monday morning: the week that just started is the one to look at.
    at('2026-01-12T09:00:00-05:00');

    expect(defaultReviewMode(weeklyMonday, EST)).toBe('remainder');
  });

  it('reads the eve through the day boundary hour, not midnight', () => {
    // 1am Monday is still Sunday for someone whose day starts at 4am, so this is
    // the eve and the default is the week about to start. Reading the wall clock
    // instead would call it Monday and open on a week already underway.
    at('2026-01-12T01:00:00-05:00');

    expect(defaultReviewMode(weeklyMonday, EST)).toBe('upcoming');
  });

  it('falls back to this cycle for a cadence that cannot produce a period', () => {
    at('2026-01-07T12:00:00-05:00');

    // Biweekly with no anchor: the page will refuse to render a period anyway.
    expect(defaultReviewMode(rule({ recurrenceType: 'biweekly', recurrenceDayOfWeek: 1 }), EST)).toBe(
      'remainder'
    );
  });

  it('honors a biweekly anchor', () => {
    at('2026-01-11T21:00:00-05:00'); // the eve of an anchored Monday

    expect(
      defaultReviewMode(rule({ recurrenceType: 'biweekly', recurrenceDayOfWeek: 1 }), EST, {
        anchorDate: '2026-01-12',
      })
    ).toBe('upcoming');
  });
});
