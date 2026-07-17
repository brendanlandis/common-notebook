import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getTodayForRecurrence,
  getToday,
  parseDate,
  toISODate,
  formatInTimezone,
  getISOTimestamp,
  shiftISODate,
  isoDayDiff,
} from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

// No vi.mock: the timezone and day boundary are parameters now, so each case
// just passes the settings it wants. Nothing here mocks ./dateUtils — that is the
// whole point: these are the functions three incidents passed through untested.
const est = (dayBoundaryHour: number): TimeZoneSettings => ({
  timezone: 'America/New_York',
  dayBoundaryHour,
});

const settingsFor = (timezone: string): TimeZoneSettings => ({ timezone, dayBoundaryHour: 4 });

describe('Date Utilities', () => {
  describe('getTodayForRecurrence with day boundary', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return previous day when before boundary hour (2am with 4am boundary)', () => {
      // Mock current time as 2am Tuesday
      vi.setSystemTime(new Date('2026-01-06T02:00:00-05:00')); // 2am EST Tuesday

      const result = getTodayForRecurrence(est(4));

      // Should count as Monday since it's before 4am boundary
      expect(result.toISOString().split('T')[0]).toBe('2026-01-05'); // Monday
    });

    it('should return current day when after boundary hour (5am with 4am boundary)', () => {
      vi.setSystemTime(new Date('2026-01-06T05:00:00-05:00')); // 5am EST Tuesday

      const result = getTodayForRecurrence(est(4));

      // Should count as Tuesday since it's after 4am boundary
      expect(result.toISOString().split('T')[0]).toBe('2026-01-06'); // Tuesday
    });

    it('should return current day when at boundary hour (4am with 4am boundary)', () => {
      vi.setSystemTime(new Date('2026-01-06T04:00:00-05:00')); // 4am EST Tuesday

      const result = getTodayForRecurrence(est(4));

      // Should count as Tuesday since it's at the boundary (>= logic)
      expect(result.toISOString().split('T')[0]).toBe('2026-01-06'); // Tuesday
    });

    it('should work correctly with midnight boundary', () => {
      vi.setSystemTime(new Date('2026-01-05T23:00:00-05:00')); // 11pm EST Monday

      const result = getTodayForRecurrence(est(0));

      // With midnight boundary, 11pm Monday should be Monday
      expect(result.toISOString().split('T')[0]).toBe('2026-01-05'); // Monday
    });

    it('should handle late night (11:59pm) correctly with 4am boundary', () => {
      vi.setSystemTime(new Date('2026-01-05T23:59:00-05:00')); // 11:59pm EST Monday

      const result = getTodayForRecurrence(est(4));

      // Should still count as Monday (before 4am boundary, but same calendar day)
      expect(result.toISOString().split('T')[0]).toBe('2026-01-05'); // Monday
    });

    it('resolves the same instant to a different day per timezone', () => {
      // 05:00 EST Tuesday is 02:00 PST Tuesday. With a 4am boundary the east
      // coast is past it (Tuesday) and the west coast is not (still Monday) —
      // which is why the timezone has to travel with the boundary.
      vi.setSystemTime(new Date('2026-01-06T05:00:00-05:00'));

      expect(getTodayForRecurrence(est(4)).toISOString().split('T')[0]).toBe('2026-01-06');
      expect(
        getTodayForRecurrence({ timezone: 'America/Los_Angeles', dayBoundaryHour: 4 })
          .toISOString()
          .split('T')[0]
      ).toBe('2026-01-05');
    });
  });

  // The round-trip at the centre of three incidents, asserted nowhere until now.
  // Runs across timezones at the settings level; the suite also runs under three
  // machine zones via `npm run test:zones`, so a positive-offset regression like
  // Kolkata's cannot hide behind a matching OS zone.
  describe('parseDate ↔ toISODate round-trip', () => {
    const zones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Australia/Eucla'];
    const dates = ['2026-01-05', '2026-06-15', '2026-11-01', '2026-12-31', '2028-02-29'];
    for (const zone of zones) {
      for (const date of dates) {
        it(`${date} in ${zone}`, () => {
          expect(toISODate(parseDate(date, settingsFor(zone)), settingsFor(zone))).toBe(date);
        });
      }
    }
  });

  describe('parseDate', () => {
    it('interprets the date as midnight in the settings zone, returning a real instant', () => {
      expect(parseDate('2026-01-05', est(4)).toISOString()).toBe('2026-01-05T05:00:00.000Z'); // EST = UTC-5
    });
    it('honors the zone offset (IST = UTC+5:30)', () => {
      expect(parseDate('2026-01-05', settingsFor('Asia/Kolkata')).toISOString()).toBe('2026-01-04T18:30:00.000Z');
    });
  });

  describe('toISODate', () => {
    it('returns the calendar day in the settings zone, not the machine or UTC', () => {
      // 02:00 UTC is still the previous evening (21:00) in New York.
      expect(toISODate(new Date('2026-01-05T02:00:00Z'), est(4))).toBe('2026-01-04');
    });
    it('returns the same instant later in the day for a positive offset', () => {
      expect(toISODate(new Date('2026-01-05T02:00:00Z'), settingsFor('Asia/Kolkata'))).toBe('2026-01-05');
    });
  });

  describe('getToday', () => {
    afterEach(() => vi.useRealTimers());
    it('returns midnight of the current day in the settings zone', () => {
      vi.setSystemTime(new Date('2026-06-15T18:00:00Z')); // 14:00 EDT
      expect(toISODate(getToday(est(4)), est(4))).toBe('2026-06-15');
      expect(getToday(est(4)).toISOString()).toBe('2026-06-15T04:00:00.000Z'); // EDT midnight = 04:00Z
    });
  });

  describe('formatInTimezone', () => {
    it('fast path (yyyy-MM-dd) reads the day in the settings zone', () => {
      expect(formatInTimezone(new Date('2026-01-05T02:00:00Z'), 'yyyy-MM-dd', est(4))).toBe('2026-01-04');
    });
    it('formatTz path carries the correct offset through the ambiguous fall-back hour (R5)', () => {
      // US DST ends 2026-11-01 02:00, so 01:30 local happens twice: once at EDT
      // (-04:00, 05:30Z) and once at EST (-05:00, 06:30Z). Without originalDate both
      // rendered the same offset and getISOTimestamp wrote a completedAt an hour off.
      expect(getISOTimestamp(est(4), new Date('2026-11-01T05:30:00Z'))).toBe('2026-11-01T01:30:00.000-04:00');
      expect(getISOTimestamp(est(4), new Date('2026-11-01T06:30:00Z'))).toBe('2026-11-01T01:30:00.000-05:00');
    });
  });

  describe('shiftISODate', () => {
    it('crosses month, year, and leap boundaries on the UTC calendar', () => {
      expect(shiftISODate('2026-03-01', -1)).toBe('2026-02-28');
      expect(shiftISODate('2026-01-01', -1)).toBe('2025-12-31');
      expect(shiftISODate('2028-03-01', -1)).toBe('2028-02-29');
      expect(shiftISODate('2026-12-31', 1)).toBe('2027-01-01');
    });
    it('is unaffected by a DST transition in the span', () => {
      // US DST began 2026-03-08; a local-component step could land a day short.
      expect(shiftISODate('2026-03-29', -29)).toBe('2026-02-28');
    });
  });

  describe('isoDayDiff', () => {
    it('counts whole days, signed, across month and year ends', () => {
      expect(isoDayDiff('2026-01-05', '2026-01-05')).toBe(0);
      expect(isoDayDiff('2026-01-06', '2026-01-05')).toBe(1);
      expect(isoDayDiff('2026-01-05', '2026-01-06')).toBe(-1);
      expect(isoDayDiff('2027-01-01', '2026-12-31')).toBe(1);
      expect(isoDayDiff('2026-03-29', '2026-03-08')).toBe(21); // spans US spring-forward
    });
  });
});
