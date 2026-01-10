import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEffectiveDayForTimestamp, getWorkedOnPhase } from '../dayBoundaryHelpers';
import * as timezoneConfig from '../timezoneConfig';
import * as dateUtils from '../dateUtils';

// Mock timezone config - using UTC for testing (no timezone offset)
vi.mock('../timezoneConfig', () => ({
  getTimezone: vi.fn(() => 'UTC'),
  getDayBoundaryHour: vi.fn(() => 4),
}));

// Mock date utilities
vi.mock('../dateUtils', () => ({
  // Simulate toZonedTime behavior for UTC timezone
  // For UTC, there's no offset, so we just return the date as-is
  // The returned date has UTC values accessible via getUTC* methods
  toZonedTime: (date: Date, timezone: string) => {
    // For UTC timezone (no offset), return the date unchanged
    // The implementation will use getUTCHours() etc. to access values
    return date;
  },
  toISODateInEST: (date: Date) => {
    // Extract date components using UTC methods (since we're testing in UTC)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
}));

describe('Day Boundary Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEffectiveDayForTimestamp', () => {
    it('should return same day when after boundary hour', () => {
      // 10 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T10:00:00.000Z');
      const dayBoundaryHour = 4; // 4 AM

      const result = getEffectiveDayForTimestamp(timestamp, dayBoundaryHour);

      expect(result).toBe('2026-01-05');
    });

    it('should return previous day when before boundary hour', () => {
      // 2 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T02:00:00.000Z');
      const dayBoundaryHour = 4; // 4 AM

      const result = getEffectiveDayForTimestamp(timestamp, dayBoundaryHour);

      expect(result).toBe('2026-01-04');
    });

    it('should return same day when exactly at boundary hour', () => {
      // 4 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T04:00:00.000Z');
      const dayBoundaryHour = 4;

      const result = getEffectiveDayForTimestamp(timestamp, dayBoundaryHour);

      expect(result).toBe('2026-01-05');
    });

    it('should handle midnight boundary (0)', () => {
      // 1 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T01:00:00.000Z');
      const dayBoundaryHour = 0;

      const result = getEffectiveDayForTimestamp(timestamp, dayBoundaryHour);

      expect(result).toBe('2026-01-05');
    });

    it('should handle noon boundary (12)', () => {
      // 10 AM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T10:00:00.000Z');
      const dayBoundaryHour = 12;

      const result = getEffectiveDayForTimestamp(timestamp, dayBoundaryHour);

      expect(result).toBe('2026-01-04'); // Before noon, so previous day
    });

    it('should handle end-of-day boundary (23)', () => {
      // 11 PM UTC on Jan 5, 2026
      const timestamp = new Date('2026-01-05T23:00:00.000Z');
      const dayBoundaryHour = 23;

      const result = getEffectiveDayForTimestamp(timestamp, dayBoundaryHour);

      // 23 is NOT < 23, so no adjustment
      // Effective day is Jan 5
      expect(result).toBe('2026-01-05');
    });
  });

  describe('getWorkedOnPhase', () => {
    describe('Phase 1 - Within visibility window, same effective day', () => {
      it('should return phase 1 when within visibility minutes and same day', () => {
        // Work session at 10:00 AM, now is 10:30 AM (30 mins later)
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-05T10:30:00.000Z');
        const visibilityMinutes = 60; // 1 hour
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        expect(phase).toBe(1);
      });

      it('should return phase 1 exactly at visibility boundary', () => {
        // Work session at 10:00 AM, now is 11:00 AM (60 mins later)
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-05T11:00:00.000Z');
        const visibilityMinutes = 60;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        expect(phase).toBe(1);
      });
    });

    describe('Phase 2 - Beyond visibility window, same effective day', () => {
      it('should return phase 2 when beyond visibility minutes but same day', () => {
        // Work session at 10:00 AM, now is 11:01 AM (61 mins later)
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-05T11:01:00.000Z');
        const visibilityMinutes = 60;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        expect(phase).toBe(2);
      });

      it('should return phase 2 when hours past visibility window but same effective day', () => {
        // Work session at 10:00 AM, now is 11:00 PM (13 hours later)
        // Both are same effective day (after 4 AM)
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-05T23:00:00.000Z');
        const visibilityMinutes = 60;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        expect(phase).toBe(2);
      });
    });

    describe('Phase 3 - Different effective day', () => {
      it('should return phase 3 when crossing to different effective day', () => {
        // Work session at 10:00 AM UTC Jan 5, now is 5:00 AM UTC Jan 6
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-06T05:00:00.000Z');
        const visibilityMinutes = 60;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        // 10 AM Jan 5 -> after 4 AM boundary -> effective day is Jan 5
        // 5 AM Jan 6 -> after 4 AM boundary -> effective day is Jan 6
        // Different effective days -> Phase 3
        expect(phase).toBe(3);
      });

      it('should return phase 1 when within visibility on same effective day', () => {
        // Work session at 11:50 PM UTC Jan 5, now is 12:10 AM UTC Jan 6 (20 mins later)
        // Both times are after 4 AM boundary, so same effective day (still Jan 5)
        const workSessionTimestamp = '2026-01-05T23:50:00.000Z';
        const now = new Date('2026-01-06T00:10:00.000Z');
        const visibilityMinutes = 60;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        // 11:50 PM Jan 5 -> before 4 AM boundary, effective day is Jan 5
        // 12:10 AM Jan 6 -> before 4 AM boundary, effective day is Jan 5
        // Same effective day, 20 minutes passed, within 60 minute visibility window
        expect(phase).toBe(1);
      });

      it('should return phase 3 when crossing the 4am boundary', () => {
        // Work session at 11:50 PM UTC Jan 5, now is 5:00 AM UTC Jan 6
        const workSessionTimestamp = '2026-01-05T23:50:00.000Z';
        const now = new Date('2026-01-06T05:00:00.000Z');
        const visibilityMinutes = 60;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        // 11:50 PM Jan 5 -> before 4 AM boundary -> effective day is Jan 5
        // 5:00 AM Jan 6 -> after 4 AM boundary -> effective day is Jan 6
        // Different effective days -> Phase 3
        expect(phase).toBe(3);
      });
    });

    describe('Edge cases with 1440 minute visibility', () => {
      it('should return phase 3 when day boundary crossed even with long visibility', () => {
        // Work session at 10:00 AM UTC Jan 5, now is 5:00 AM UTC Jan 6
        // Visibility is 1440 minutes (24 hours)
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-06T05:00:00.000Z');
        const visibilityMinutes = 1440;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        // 19 hours passed (1140 minutes), within 1440 minute window
        // BUT: 10 AM Jan 5 -> effective day is Jan 5
        //      5 AM Jan 6 -> effective day is Jan 6
        // Different effective days -> Phase 3 (even though within visibility window)
        expect(phase).toBe(3);
      });

      it('should be phase 1 when within 24 hours and same effective day', () => {
        // Work session at 10:00 AM Jan 5, now is 11:00 PM Jan 5
        // Visibility is 1440 minutes (24 hours)
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-05T23:00:00.000Z');
        const visibilityMinutes = 1440;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        // 13 hours have passed, within 1440 minute window, same effective day
        expect(phase).toBe(1);
      });
    });

    describe('Day boundary crossing scenarios', () => {
      it('should return phase 3 when crossing day boundary even on same calendar day', () => {
        // Work session at 3:50 AM UTC, now is 4:10 AM UTC (same calendar day)
        const workSessionTimestamp = '2026-01-05T03:50:00.000Z';
        const now = new Date('2026-01-05T04:10:00.000Z');
        const visibilityMinutes = 15;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        // 3:50 AM -> before 4 AM boundary -> effective day is Jan 4
        // 4:10 AM -> after 4 AM boundary -> effective day is Jan 5
        // Different effective days -> Phase 3 (even though same calendar day)
        expect(phase).toBe(3);
      });
    });

    describe('Zero visibility minutes', () => {
      it('should immediately be phase 2 with zero visibility', () => {
        // Work session at 10:00 AM, now is 10:00:01 AM (1 second later)
        const workSessionTimestamp = '2026-01-05T10:00:00.000Z';
        const now = new Date('2026-01-05T10:00:01.000Z');
        const visibilityMinutes = 0;
        const dayBoundaryHour = 4;

        const phase = getWorkedOnPhase(workSessionTimestamp, now, visibilityMinutes, dayBoundaryHour);

        expect(phase).toBe(2);
      });
    });
  });
});
