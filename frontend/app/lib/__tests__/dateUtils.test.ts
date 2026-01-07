import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTodayForRecurrence, getCompletionDateForRecurrence } from '../dateUtils';
import * as dayBoundaryConfig from '../dayBoundaryConfig';
import * as timezoneConfig from '../timezoneConfig';

// Mock the day boundary config
vi.mock('../dayBoundaryConfig');

// Mock the timezone config to ensure consistent behavior across environments
vi.mock('../timezoneConfig', () => ({
  getTimezone: vi.fn(() => 'America/New_York'),
  setCachedTimezone: vi.fn(),
  fetchTimezoneFromStrapi: vi.fn(),
  saveTimezoneToStrapi: vi.fn(),
}));

describe('Date Utilities', () => {
  describe('getTodayForRecurrence with day boundary', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return previous day when before boundary hour (2am with 4am boundary)', () => {
      // Mock day boundary as 4am
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      // Mock current time as 2am Tuesday
      vi.setSystemTime(new Date('2026-01-06T02:00:00-05:00')); // 2am EST Tuesday
      
      const result = getTodayForRecurrence();
      
      // Should count as Monday since it's before 4am boundary
      const resultDateStr = result.toISOString().split('T')[0];
      expect(resultDateStr).toBe('2026-01-05'); // Monday
      
      vi.useRealTimers();
    });

    it('should return current day when after boundary hour (5am with 4am boundary)', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      // Mock current time as 5am Tuesday
      vi.setSystemTime(new Date('2026-01-06T05:00:00-05:00')); // 5am EST Tuesday
      
      const result = getTodayForRecurrence();
      
      // Should count as Tuesday since it's after 4am boundary
      const resultDateStr = result.toISOString().split('T')[0];
      expect(resultDateStr).toBe('2026-01-06'); // Tuesday
      
      vi.useRealTimers();
    });

    it('should return current day when at boundary hour (4am with 4am boundary)', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      // Mock current time as exactly 4am Tuesday
      vi.setSystemTime(new Date('2026-01-06T04:00:00-05:00')); // 4am EST Tuesday
      
      const result = getTodayForRecurrence();
      
      // Should count as Tuesday since it's at the boundary (>= logic)
      const resultDateStr = result.toISOString().split('T')[0];
      expect(resultDateStr).toBe('2026-01-06'); // Tuesday
      
      vi.useRealTimers();
    });

    it('should work correctly with midnight boundary (default)', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(0);
      
      // Mock current time as 11pm Monday
      vi.setSystemTime(new Date('2026-01-05T23:00:00-05:00')); // 11pm EST Monday
      
      const result = getTodayForRecurrence();
      
      // With midnight boundary, 11pm Monday should be Monday
      const resultDateStr = result.toISOString().split('T')[0];
      expect(resultDateStr).toBe('2026-01-05'); // Monday
      
      vi.useRealTimers();
    });

    it('should handle late night (11:59pm) correctly with 4am boundary', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      // Mock current time as 11:59pm Monday
      vi.setSystemTime(new Date('2026-01-05T23:59:00-05:00')); // 11:59pm EST Monday
      
      const result = getTodayForRecurrence();
      
      // Should still count as Monday (before 4am boundary, but same calendar day)
      const resultDateStr = result.toISOString().split('T')[0];
      expect(resultDateStr).toBe('2026-01-05'); // Monday
      
      vi.useRealTimers();
    });
  });

  describe('getCompletionDateForRecurrence', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return previous day when completion at 2am with 4am boundary', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      const completionTime = new Date('2026-01-06T02:00:00-05:00'); // 2am EST Tuesday
      const result = getCompletionDateForRecurrence(completionTime);
      
      // Should count as Monday since completion was before 4am
      expect(result).toBe('2026-01-05'); // Monday
    });

    it('should return current day when completion at 5am with 4am boundary', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      const completionTime = new Date('2026-01-06T05:00:00-05:00'); // 5am EST Tuesday
      const result = getCompletionDateForRecurrence(completionTime);
      
      // Should count as Tuesday since completion was after 4am
      expect(result).toBe('2026-01-06'); // Tuesday
    });

    it('should return ISO date string in correct format', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      const completionTime = new Date('2026-01-15T14:30:00-05:00'); // 2:30pm EST
      const result = getCompletionDateForRecurrence(completionTime);
      
      // Should be in YYYY-MM-DD format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe('2026-01-15');
    });

    it('should handle midnight completion with midnight boundary', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(0);
      
      const completionTime = new Date('2026-01-06T00:00:00-05:00'); // Midnight Tuesday
      const result = getCompletionDateForRecurrence(completionTime);
      
      // At midnight with midnight boundary, should be current day
      expect(result).toBe('2026-01-06'); // Tuesday
    });

    it('should handle 3:59am completion with 4am boundary as previous day', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      const completionTime = new Date('2026-01-06T03:59:00-05:00'); // 3:59am Tuesday
      const result = getCompletionDateForRecurrence(completionTime);
      
      // Just before boundary, should count as previous day
      expect(result).toBe('2026-01-05'); // Monday
    });

    it('should handle 4:00am completion with 4am boundary as current day', () => {
      vi.mocked(dayBoundaryConfig.getDayBoundaryHour).mockReturnValue(4);
      
      const completionTime = new Date('2026-01-06T04:00:00-05:00'); // 4:00am Tuesday
      const result = getCompletionDateForRecurrence(completionTime);
      
      // At boundary, should count as current day
      expect(result).toBe('2026-01-06'); // Tuesday
    });
  });
});

