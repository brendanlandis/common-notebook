import { describe, it, expect } from 'vitest';
import { getEffectiveDayForTimestamp, getWorkedOnPhase } from './dayBoundaryHelpers';
import { shiftISODate } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

// The timezone travels with the boundary now, so each case builds its own settings
// instead of mocking an ambient module. UTC keeps the arithmetic offset-free.
const utc = (dayBoundaryHour: number): TimeZoneSettings => ({ timezone: 'UTC', dayBoundaryHour });
const nyc = (dayBoundaryHour: number): TimeZoneSettings => ({
  timezone: 'America/New_York',
  dayBoundaryHour,
});

// This suite deliberately does NOT mock ./dateUtils.
//
// It used to, and the mock is what let a real bug live here for months: it stubbed
// the zone conversion as the identity function and toISODate as a reader of UTC
// components, which is only true when the timezone *and* the machine are both UTC.
// Under that mock the implementation could read the wall clock off the wrong field
// and every test still passed. CI runs UTC, so CI agreed. The New York cases below
// are the ones that would have caught it, and they only mean anything against the
// real (Temporal-backed) timezone conversion.
//
// These assertions must hold whatever timezone the machine running them is in.

describe('Day Boundary Helpers', () => {
  describe('shiftISODate', () => {
    it('steps back a day', () => {
      expect(shiftISODate('2026-07-17', -1)).toBe('2026-07-16');
    });

    it('steps back across a month end', () => {
      expect(shiftISODate('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('steps back across a year end', () => {
      expect(shiftISODate('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('steps back across a leap day', () => {
      expect(shiftISODate('2028-03-01', -1)).toBe('2028-02-29');
    });

    it('steps back a month across a DST transition', () => {
      // US DST began 2026-03-08. A local-component step here would land on the
      // duplicated/skipped hour and could fall a day short.
      expect(shiftISODate('2026-03-29', -29)).toBe('2026-02-28');
    });

    it('steps forward', () => {
      expect(shiftISODate('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('is a no-op for zero', () => {
      expect(shiftISODate('2026-07-17', 0)).toBe('2026-07-17');
    });
  });

  describe('getEffectiveDayForTimestamp', () => {
    it('should return same day when after boundary hour', () => {
      // 10 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T10:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, utc(4))).toBe('2026-01-05');
    });

    it('should return previous day when before boundary hour', () => {
      // 2 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T02:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, utc(4))).toBe('2026-01-04');
    });

    it('should return same day when exactly at boundary hour', () => {
      // 4 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T04:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, utc(4))).toBe('2026-01-05');
    });

    it('should handle midnight boundary (0)', () => {
      // 1 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T01:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, utc(0))).toBe('2026-01-05');
    });

    it('should handle noon boundary (12)', () => {
      // 10 AM UTC on Jan 5, 2026 — before noon, so previous day
      const timestamp = new Date('2026-01-05T10:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, utc(12))).toBe('2026-01-04');
    });

    it('should handle end-of-day boundary (23)', () => {
      // 11 PM UTC on Jan 5, 2026. 23 is NOT < 23, so no adjustment.
      const timestamp = new Date('2026-01-05T23:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, utc(23))).toBe('2026-01-05');
    });
  });

  // The boundary is a wall-clock hour in the user's zone, not in UTC and not on the
  // machine. Every case here is a real instant whose UTC calendar day differs from
  // its New York one, or whose New York hour sits on the other side of the boundary
  // from its UTC hour — so reading the wrong components lands on the wrong day.
  describe('getEffectiveDayForTimestamp in a non-UTC timezone', () => {
    it('uses the local evening, not the next UTC day', () => {
      // 02:30 UTC Jan 8 = 21:30 Jan 7 in New York — an evening after the 4am boundary.
      const timestamp = new Date('2026-01-08T02:30:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, nyc(4))).toBe('2026-01-07');
    });

    it('returns the previous day before the local boundary', () => {
      // 06:00 UTC Jan 8 = 01:00 Jan 8 in New York — after midnight, before 4am.
      const timestamp = new Date('2026-01-08T06:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, nyc(4))).toBe('2026-01-07');
    });

    it('rolls over at the local boundary, not five hours early', () => {
      // 10:00 UTC Jan 8 = 05:00 Jan 8 in New York — just past the 4am boundary.
      const timestamp = new Date('2026-01-08T10:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, nyc(4))).toBe('2026-01-08');
    });

    it('handles a local midday', () => {
      // 17:00 UTC Jan 8 = 12:00 Jan 8 in New York.
      const timestamp = new Date('2026-01-08T17:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, nyc(4))).toBe('2026-01-08');
    });

    it('honours the summer offset (EDT, -4) as well as the winter one', () => {
      // 05:00 UTC Jul 16 = 01:00 Jul 16 in New York (EDT) — before the 4am boundary.
      const timestamp = new Date('2026-07-16T05:00:00.000Z');

      expect(getEffectiveDayForTimestamp(timestamp, nyc(4))).toBe('2026-07-15');
    });
  });

  describe('getWorkedOnPhase', () => {
    describe('Phase 1 - Within visibility window, same effective day', () => {
      it('should return phase 1 when within visibility minutes and same day', () => {
        // Work session at 10:00 AM, now is 10:30 AM (30 mins later)
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-05T10:30:00.000Z'),
          60,
          utc(4)
        );

        expect(phase).toBe(1);
      });

      it('should return phase 1 exactly at visibility boundary', () => {
        // Work session at 10:00 AM, now is 11:00 AM (60 mins later)
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-05T11:00:00.000Z'),
          60,
          utc(4)
        );

        expect(phase).toBe(1);
      });
    });

    describe('Phase 2 - Beyond visibility window, same effective day', () => {
      it('should return phase 2 when beyond visibility minutes but same day', () => {
        // Work session at 10:00 AM, now is 11:01 AM (61 mins later)
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-05T11:01:00.000Z'),
          60,
          utc(4)
        );

        expect(phase).toBe(2);
      });

      it('should return phase 2 when hours past visibility window but same effective day', () => {
        // Work session at 10:00 AM, now is 11:00 PM (13 hours later). Both are the
        // same effective day (after 4 AM).
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-05T23:00:00.000Z'),
          60,
          utc(4)
        );

        expect(phase).toBe(2);
      });
    });

    describe('Phase 3 - Different effective day', () => {
      it('should return phase 3 when crossing to different effective day', () => {
        // 10 AM Jan 5 -> after the 4 AM boundary -> effective day Jan 5.
        // 5 AM Jan 6 -> after the 4 AM boundary -> effective day Jan 6.
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-06T05:00:00.000Z'),
          60,
          utc(4)
        );

        expect(phase).toBe(3);
      });

      it('should return phase 1 when within visibility on same effective day', () => {
        // 11:50 PM Jan 5 -> after the boundary -> effective day Jan 5.
        // 12:10 AM Jan 6 -> before the boundary -> effective day Jan 5 as well.
        // Same effective day, 20 minutes apart, inside the 60 minute window.
        const phase = getWorkedOnPhase(
          '2026-01-05T23:50:00.000Z',
          new Date('2026-01-06T00:10:00.000Z'),
          60,
          utc(4)
        );

        expect(phase).toBe(1);
      });

      it('should return phase 3 when crossing the 4am boundary', () => {
        // 11:50 PM Jan 5 -> effective day Jan 5.
        // 5:00 AM Jan 6 -> after the boundary -> effective day Jan 6.
        const phase = getWorkedOnPhase(
          '2026-01-05T23:50:00.000Z',
          new Date('2026-01-06T05:00:00.000Z'),
          60,
          utc(4)
        );

        expect(phase).toBe(3);
      });
    });

    describe('Edge cases with 1440 minute visibility', () => {
      it('should return phase 3 when day boundary crossed even with long visibility', () => {
        // 19 hours passed (1140 minutes), inside the 1440 minute window — but the
        // effective day changed (Jan 5 -> Jan 6), and that wins.
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-06T05:00:00.000Z'),
          1440,
          utc(4)
        );

        expect(phase).toBe(3);
      });

      it('should be phase 1 when within 24 hours and same effective day', () => {
        // 13 hours have passed, within the 1440 minute window, same effective day.
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-05T23:00:00.000Z'),
          1440,
          utc(4)
        );

        expect(phase).toBe(1);
      });
    });

    describe('Day boundary crossing scenarios', () => {
      it('should return phase 3 when crossing day boundary even on same calendar day', () => {
        // 3:50 AM -> before the boundary -> effective day Jan 4.
        // 4:10 AM -> after the boundary -> effective day Jan 5.
        const phase = getWorkedOnPhase(
          '2026-01-05T03:50:00.000Z',
          new Date('2026-01-05T04:10:00.000Z'),
          15,
          utc(4)
        );

        expect(phase).toBe(3);
      });

      // The same crossing, expressed in the user's zone rather than UTC. With the
      // hour read off the wrong components this came back as phase 2: the boundary
      // effectively sat at 9am New York time, so neither instant had crossed it.
      it('crosses the boundary at 4am local, not 4am UTC', () => {
        // 08:00 UTC Jan 8 = 03:00 New York -> before the boundary -> effective Jan 7.
        // 10:00 UTC Jan 8 = 05:00 New York -> after the boundary -> effective Jan 8.
        const phase = getWorkedOnPhase(
          '2026-01-08T08:00:00.000Z',
          new Date('2026-01-08T10:00:00.000Z'),
          15,
          nyc(4)
        );

        expect(phase).toBe(3);
      });

      it('does not cross the boundary merely because UTC rolled over', () => {
        // 23:00 UTC Jan 7 = 18:00 Jan 7 New York -> effective Jan 7.
        // 01:00 UTC Jan 8 = 20:00 Jan 7 New York -> still effective Jan 7.
        // The UTC calendar day changed; the user's day did not.
        const phase = getWorkedOnPhase(
          '2026-01-07T23:00:00.000Z',
          new Date('2026-01-08T01:00:00.000Z'),
          15,
          nyc(4)
        );

        expect(phase).toBe(2);
      });
    });

    describe('Zero visibility minutes', () => {
      it('should immediately be phase 2 with zero visibility', () => {
        // Work session at 10:00 AM, now is 10:00:01 AM (1 second later)
        const phase = getWorkedOnPhase(
          '2026-01-05T10:00:00.000Z',
          new Date('2026-01-05T10:00:01.000Z'),
          0,
          utc(4)
        );

        expect(phase).toBe(2);
      });
    });
  });
});
