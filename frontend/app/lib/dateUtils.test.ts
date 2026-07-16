import { describe, it, expect, afterEach, vi } from 'vitest';
import { getTodayForRecurrence } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

// No vi.mock: the timezone and day boundary are parameters now, so each case
// just passes the settings it wants.
const est = (dayBoundaryHour: number): TimeZoneSettings => ({
  timezone: 'America/New_York',
  dayBoundaryHour,
});

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
});
