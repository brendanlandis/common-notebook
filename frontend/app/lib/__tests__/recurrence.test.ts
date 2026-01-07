import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateNextRecurrence } from '../recurrence';
import type { Todo } from '@/app/types/admin';
import * as dateUtils from '../dateUtils';

// Mock the date utilities to have consistent test dates
vi.mock('../dateUtils', async () => {
  const actual = await vi.importActual('../dateUtils');
  return {
    ...actual,
    getTodayForRecurrence: vi.fn(),
    getTodayInEST: vi.fn(),
    parseInEST: (dateString: string) => new Date(dateString + 'T00:00:00'),
    toISODateInEST: (date: Date) => date.toISOString().split('T')[0],
  };
});

// Mock the timezone config to ensure consistent behavior across environments
vi.mock('../timezoneConfig', () => ({
  getTimezone: vi.fn(() => 'America/New_York'),
  setCachedTimezone: vi.fn(),
  fetchTimezoneFromStrapi: vi.fn(),
  saveTimezoneToStrapi: vi.fn(),
}));

// Helper to create minimal todo for testing
function createTodo(overrides: Partial<Todo>): Todo {
  return {
    id: 1,
    documentId: 'test-1',
    title: 'Test task',
    description: [],
    completed: false,
    completedAt: null,
    dueDate: null,
    displayDate: null,
    displayDateOffset: null,
    isRecurring: false,
    recurrenceType: 'none',
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    category: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    createdAt: '',
    updatedAt: '',
    publishedAt: '',
    ...overrides,
  };
}

describe('Recurrence Logic', () => {
  beforeEach(() => {
    // Set a fixed "today" for all tests - Monday, Jan 5, 2026
    vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
    vi.mocked(dateUtils.getTodayInEST).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
  });

  describe('Daily Recurrence', () => {
    it('should display today on initial creation', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: null,
      });

      const result = calculateNextRecurrence(todo, true);

      expect(result.displayDate).toBe('2026-01-05'); // Today
      expect(result.dueDate).toBe(null);
    });

    it('should schedule for tomorrow after completion', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-06'); // Tomorrow
      expect(result.dueDate).toBe(null);
    });

    it('should drift from actual completion date', () => {
      // Simulate completing on Jan 10 instead of Jan 5
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-10T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-11'); // Day after actual completion
    });
  });

  describe('Every X Days Recurrence', () => {
    it('should display today on initial creation', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 3,
      });

      const result = calculateNextRecurrence(todo, true);

      expect(result.displayDate).toBe('2026-01-05'); // Today
    });

    it('should schedule X days after completion', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 3,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-08'); // 3 days later
    });

    it('should work with 7 day interval', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 7,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-12'); // 7 days later
    });

    it('should return null if interval is missing', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: null,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe(null);
    });
  });

  describe('Weekly Recurrence - Critical Bug Fix', () => {
    it('should find next target weekday on initial creation (not today)', () => {
      // Today is Monday (1), create task for Wednesday (3)
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 3, // Wednesday
      });

      const result = calculateNextRecurrence(todo, true);

      expect(result.displayDate).toBe('2026-01-07'); // Next Wednesday
    });

    it('should schedule 7 days later when completed on target day', () => {
      // Today is Monday Jan 5, completing Monday task
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-12'); // Next Monday (7 days, NOT 14)
    });

    it('should find next target weekday when completed on different day', () => {
      // Today is Monday, but task is for Wednesday
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 3, // Wednesday
        displayDate: '2026-01-01',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-07'); // Next Wednesday
    });

    it('should work correctly for Sunday tasks', () => {
      // Today is Monday, create task for Sunday (7 in our format)
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 7, // Sunday
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-11'); // Next Sunday
    });

    it('should return null if recurrenceDayOfWeek is missing', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: null,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe(null);
    });
  });

  describe('Biweekly Recurrence - Critical Bug Fix', () => {
    it('should find next target weekday on initial creation', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1, // Monday
      });

      const result = calculateNextRecurrence(todo, true);

      // nextDay() skips today, so next Monday is 7 days away
      expect(result.displayDate).toBe('2026-01-12'); // Next Monday
    });

    it('should maintain strict 14-day cycle from displayDate', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-19'); // Jan 5 + 14 days
    });

    it('should maintain schedule even when completed 5 days late', () => {
      // Completed on Jan 10, but displayDate was Jan 5
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-10T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should maintain original cycle: Jan 5 + 14 = Jan 19
      expect(result.displayDate).toBe('2026-01-19');
    });

    it('should skip to next valid cycle if completed very late', () => {
      // Completed on Feb 2, displayDate was Jan 5
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-02-02T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Jan 5 + 14 = Jan 19 (past)
      // Jan 19 + 14 = Feb 2 (today, not future)
      // Feb 2 + 14 = Feb 16
      expect(result.displayDate).toBe('2026-02-16');
    });

    it('should return null if recurrenceDayOfWeek is missing', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: null,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe(null);
    });

    it('should return null if displayDate is missing', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: null,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe(null);
    });
  });

  describe('Monthly Date Recurrence', () => {
    it('should schedule for same day next month', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        dueDate: '2026-01-15',
        displayDateOffset: 7, // Need offset to get both dates
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.dueDate).toBe('2026-02-15');
      expect(result.displayDate).toBe('2026-02-08'); // 7 days before
    });

    it('should set both dueDate and displayDate with offset', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-08',
        dueDate: '2026-01-15',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.dueDate).toBe('2026-02-15');
      expect(result.displayDate).toBe('2026-02-08'); // 7 days before
    });

    it('should only set displayDate without offset', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        displayDateOffset: 0,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-02-15');
      expect(result.dueDate).toBe(null);
    });

    it('should use last day of month when target day does not exist (Feb 31)', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 31,
        displayDate: '2026-01-31',
        dueDate: '2026-01-31',
      });

      const result = calculateNextRecurrence(todo, false);

      // Feb 2026 has 28 days (not a leap year)
      expect(result.displayDate).toBe('2026-02-28');
    });

    it('should handle Feb 29 in leap year', () => {
      // 2028 is a leap year
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2028-01-31T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 29,
        displayDate: '2028-01-29',
        dueDate: '2028-01-29',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2028-02-29'); // Leap year!
    });
  });

  describe('Monthly Day Recurrence', () => {
    it('should schedule for 2nd Tuesday of next month', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2, // 2nd week
        recurrenceDayOfWeekMonthly: 2, // Tuesday (1=Mon, 2=Tue, etc.)
        displayDate: '2026-01-06', // 1 week before 2nd Tuesday
        dueDate: '2026-01-13',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.dueDate).toBe('2026-02-10'); // 2nd Tuesday of Feb
      expect(result.displayDate).toBe('2026-02-03'); // 7 days before
    });

    it('should handle last Friday of month', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: -1, // Last week
        recurrenceDayOfWeekMonthly: 5, // Friday (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri)
        displayDate: '2026-01-23', // Week before last Friday
        dueDate: '2026-01-30',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.dueDate).toBe('2026-02-27'); // Last Friday of Feb
      expect(result.displayDate).toBe('2026-02-20'); // 7 days before
    });

    it('should work with offset', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 2, // Tuesday
        displayDate: '2026-01-06',
        dueDate: '2026-01-13',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.dueDate).toBe('2026-02-10');
      expect(result.displayDate).toBe('2026-02-03'); // 7 days before
    });
  });

  describe('Annually Recurrence', () => {
    it('should schedule for same date next year', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'annually',
        recurrenceMonth: 3, // March
        recurrenceDayOfMonth: 15,
        displayDate: '2026-03-15',
        dueDate: '2026-03-15',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2027-03-15');
    });

    it('should handle Feb 29 in non-leap year', () => {
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2027-02-28T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'annually',
        recurrenceMonth: 2, // February
        recurrenceDayOfMonth: 29,
        displayDate: '2026-02-28',
        dueDate: '2026-02-28',
      });

      const result = calculateNextRecurrence(todo, false);

      // 2028 is a leap year, so Feb 29 exists
      expect(result.displayDate).toBe('2028-02-29');
    });

    it('should work with offset', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'annually',
        recurrenceMonth: 3,
        recurrenceDayOfMonth: 15,
        displayDate: '2026-03-08',
        dueDate: '2026-03-15',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.dueDate).toBe('2027-03-15');
      expect(result.displayDate).toBe('2027-03-08');
    });
  });

  describe('Non-recurring tasks', () => {
    it('should return null dates for non-recurring tasks', () => {
      const todo = createTodo({
        isRecurring: false,
        recurrenceType: 'none',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe(null);
      expect(result.dueDate).toBe(null);
    });
  });

  describe('Astronomical Event Recurrence', () => {
    it('should calculate next full moon correctly', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'full moon',
        displayDate: '2026-01-05',
        dueDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should calculate next full moon after today
      expect(result.displayDate).not.toBe(null);
      expect(result.displayDate).not.toBe('2026-01-05'); // Should be different date
    });

    it('should calculate next new moon correctly', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'new moon',
        displayDate: '2026-01-05',
        dueDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).not.toBe(null);
      expect(result.displayDate).not.toBe('2026-01-05');
    });

    it('should calculate spring equinox correctly', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'spring equinox',
        displayDate: '2026-03-20',
        dueDate: '2026-03-20',
      });

      const result = calculateNextRecurrence(todo, false);

      // Next spring equinox should be in 2027
      expect(result.displayDate).not.toBe(null);
      expect(result.displayDate?.startsWith('2027-03')).toBe(true);
    });

    it('should calculate summer solstice correctly', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'summer solstice',
        displayDate: '2026-06-21',
        dueDate: '2026-06-21',
      });

      const result = calculateNextRecurrence(todo, false);

      // Next summer solstice should be in 2027
      expect(result.displayDate).not.toBe(null);
      expect(result.displayDate?.startsWith('2027-06')).toBe(true);
    });

    it('should calculate autumn equinox correctly', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'autumn equinox',
        displayDate: '2026-09-22',
        dueDate: '2026-09-23', // Actual 2026 autumn equinox date
      });

      const result = calculateNextRecurrence(todo, false);

      // Next autumn equinox should be in 2027
      expect(result.displayDate).not.toBe(null);
      expect(result.displayDate?.startsWith('2027-09')).toBe(true);
    });

    it('should calculate winter solstice correctly', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'winter solstice',
        displayDate: '2025-12-21',
        dueDate: '2025-12-21',
      });

      const result = calculateNextRecurrence(todo, false);

      // Next winter solstice should be in 2026
      expect(result.displayDate).not.toBe(null);
      expect(result.displayDate?.startsWith('2026-12')).toBe(true);
    });

    it('should calculate next season change for "every season"', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'every season',
        displayDate: '2026-01-05',
        dueDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Next season from Jan 5 should be spring equinox around March 20
      expect(result.displayDate).not.toBe(null);
      expect(result.displayDate?.startsWith('2026-03')).toBe(true);
    });

    it('should support offset for astronomical events', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'full moon',
        displayDate: '2025-12-29',
        dueDate: '2026-01-05',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(todo, false);

      // Should have both dueDate and displayDate
      expect(result.dueDate).not.toBe(null);
      expect(result.displayDate).not.toBe(null);
      
      // displayDate should be before dueDate
      if (result.displayDate && result.dueDate) {
        expect(new Date(result.displayDate) < new Date(result.dueDate)).toBe(true);
      }
    });

    it('should support no offset (day of) for astronomical events', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'full moon',
        displayDate: '2026-01-05',
        displayDateOffset: 0,
      });

      const result = calculateNextRecurrence(todo, false);

      // With no offset, should only have displayDate, no dueDate
      expect(result.displayDate).not.toBe(null);
      expect(result.dueDate).toBe(null);
    });
  });

  describe('Validation errors', () => {
    it('should return null dates for invalid configuration', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: null, // Missing required field
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe(null);
    });
  });
});

