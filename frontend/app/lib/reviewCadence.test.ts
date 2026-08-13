import { describe, it, expect } from 'vitest';
import {
  parseReviewCadence,
  serializeReviewCadence,
  cadenceIsUsable,
  defaultReviewCadence,
  type ReviewCadence,
} from './reviewCadence';
import { computeReviewPeriod } from './reviewCycle';
import type { TimeZoneSettings } from './timeZoneSettings';

const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

describe('parseReviewCadence', () => {
  it('defaults to weekly on Monday', () => {
    expect(parseReviewCadence(null)).toMatchObject({
      recurrenceType: 'weekly',
      recurrenceDayOfWeek: 1,
      isRecurring: true,
    });
  });

  it('agrees with the defaults table', () => {
    // The table is the single place a default lives; this asserts the JSON in it
    // actually parses to what the blank fallback says.
    expect(defaultReviewCadence()).toEqual(parseReviewCadence(null));
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['a JSON array', '[1,2,3]'],
    ['a bare string', '"weekly"'],
    ['null literal', 'null'],
    ['an empty string', ''],
  ])('falls back to the default on %s', (_label, stored) => {
    // A settings panel that won't render because one row holds junk is worse
    // than one showing the default.
    expect(parseReviewCadence(stored)).toEqual(parseReviewCadence(null));
  });

  it('ignores fields of the wrong type rather than passing them through', () => {
    // A string "3" reaching the recurrence engine as an interval would be
    // arithmetic on a string.
    const cadence = parseReviewCadence(
      '{"recurrenceType":"every x days","recurrenceInterval":"3"}'
    );

    expect(cadence.recurrenceInterval).toBeNull();
  });

  it('round-trips through serialize', () => {
    const cadence: ReviewCadence = {
      ...parseReviewCadence(null),
      recurrenceType: 'monthly day',
      recurrenceWeekOfMonth: -1,
      recurrenceDayOfWeekMonthly: 5,
      anchorDate: '2026-01-12',
    };

    expect(parseReviewCadence(serializeReviewCadence(cadence))).toEqual(cadence);
  });
});

describe('cadenceIsUsable', () => {
  const cadence = (overrides: Partial<ReviewCadence>): ReviewCadence => ({
    ...parseReviewCadence(null),
    ...overrides,
  });

  it('rejects biweekly without an anchor', () => {
    expect(
      cadenceIsUsable(cadence({ recurrenceType: 'biweekly', recurrenceDayOfWeek: 1 }))
    ).toBe(false);
  });

  it('accepts biweekly with an anchor', () => {
    expect(
      cadenceIsUsable(
        cadence({
          recurrenceType: 'biweekly',
          recurrenceDayOfWeek: 1,
          anchorDate: '2026-01-12',
        })
      )
    ).toBe(true);
  });

  it('accepts the astronomical cadences, which need no fields', () => {
    for (const type of ['full moon', 'new moon', 'every season'] as const) {
      expect(cadenceIsUsable(cadence({ recurrenceType: type })), type).toBe(true);
    }
  });

  it('rejects none', () => {
    expect(cadenceIsUsable(cadence({ recurrenceType: 'none' }))).toBe(false);
  });

  it('agrees with computeReviewPeriod about what actually works', () => {
    // The point of this predicate is to warn in the settings UI *before* saving
    // a cadence that would silently produce no review. If the two ever disagree,
    // one of them is lying to the user.
    const cases: ReviewCadence[] = [
      cadence({ recurrenceType: 'weekly', recurrenceDayOfWeek: 1 }),
      cadence({ recurrenceType: 'weekly', recurrenceDayOfWeek: null }),
      cadence({ recurrenceType: 'biweekly', recurrenceDayOfWeek: 1 }),
      cadence({
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        anchorDate: '2026-01-12',
      }),
      cadence({ recurrenceType: 'monthly date', recurrenceDayOfMonth: 15 }),
      cadence({ recurrenceType: 'monthly date', recurrenceDayOfMonth: null }),
      cadence({ recurrenceType: 'monthly day', recurrenceWeekOfMonth: -1 }),
      cadence({ recurrenceType: 'new moon' }),
      cadence({ recurrenceType: 'none' }),
    ];

    for (const c of cases) {
      const period = computeReviewPeriod(c, EST, {
        mode: 'upcoming',
        anchorDate: c.anchorDate,
      });
      expect(
        cadenceIsUsable(c),
        `${c.recurrenceType} (anchor=${c.anchorDate}) — predicate and period disagree`
      ).toBe(period !== null);
    }
  });
});
