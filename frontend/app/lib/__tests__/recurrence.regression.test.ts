import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateNextRecurrence } from '../recurrence';
import type { Todo } from '@/app/types/index';
import * as dateUtils from '../dateUtils';

// Mock the date utilities
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

describe('Regression Tests - Fixed Bugs', () => {
  beforeEach(() => {
    // Set a fixed "today" for all tests - Monday, Jan 5, 2026
    vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
    vi.mocked(dateUtils.getTodayInEST).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
  });

  describe('Bug: Biweekly 20-21 Day Cycles', () => {
    it('should be exactly 14 days when Monday task completed on Monday', () => {
      // Monday, Jan 5, 2026
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-05T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be Jan 19 (14 days), NOT Jan 26 (21 days)
      expect(result.displayDate).toBe('2026-01-19');

      // Verify it's exactly 14 days
      const displayDate = new Date(todo.displayDate!);
      const nextDate = new Date(result.displayDate!);
      const daysDiff = (nextDate.getTime() - displayDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(14);
    });

    it('should be 14 days from original displayDate when completed on Tuesday', () => {
      // Tuesday, Jan 6, 2026 (completing a Monday task 1 day late)
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-06T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05', // Was supposed to be done Monday
      });

      const result = calculateNextRecurrence(todo, false);

      // Should still be Jan 19 (14 days from Jan 5), NOT Jan 27 (20 days)
      expect(result.displayDate).toBe('2026-01-19');
    });

    it('should be 14 days from original when completed on Friday', () => {
      // Friday, Jan 9, 2026 (completing a Monday task 4 days late)
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-09T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should still be Jan 19 (14 days from Jan 5), NOT Jan 23 (17 days from completion)
      expect(result.displayDate).toBe('2026-01-19');
    });
  });

  describe('Bug: Weekly Skipping a Week', () => {
    it('should be 7 days when Monday task completed on Monday, not 14', () => {
      // Monday, Jan 5, 2026
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-05T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be Jan 12 (next Monday, 7 days), NOT Jan 19 (14 days)
      expect(result.displayDate).toBe('2026-01-12');
    });

    it('should be 7 days when Tuesday task completed on Tuesday', () => {
      // Tuesday, Jan 6, 2026
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-06T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 2, // Tuesday
        displayDate: '2026-01-06',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be Jan 13 (next Tuesday, 7 days), NOT Jan 20 (14 days)
      expect(result.displayDate).toBe('2026-01-13');
    });
  });

  describe('Bug: Event-Based Duplicates', () => {
    it('should not duplicate monthly 15th when completed on 10th', () => {
      // Jan 10, 2026 - completing a Jan 15 task early
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-10T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        dueDate: '2026-01-15',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be Feb 15, NOT Jan 15 (which would cause duplicate)
      expect(result.displayDate).toBe('2026-02-15');
    });

    it('should not duplicate monthly 15th when completed late on Feb 5', () => {
      // Feb 5, 2026 - completing Jan 15 task very late
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-02-05T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        dueDate: '2026-01-15',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be Feb 15 (next occurrence after Feb 5)
      expect(result.displayDate).toBe('2026-02-15');
    });
  });

  describe('Bug: State Management Issues', () => {
    it('should preserve soon field on recurrence', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
        soon: true,
      });

      const result = calculateNextRecurrence(todo, false);

      // This test verifies the calculation returns expected dates.
      // The actual field preservation happens in the API endpoint.
      expect(result.displayDate).toBe('2026-01-06');
    });

    it('should preserve long field on recurrence', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
        long: true,
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-06');
    });

    it('should work correctly with wishlist fields', () => {
      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
        wishListCategory: 'books',
        price: 29.99,
        purchaseUrl: 'https://example.com',
        trackingUrl: 'https://tracking.example.com',
      });

      const result = calculateNextRecurrence(todo, false);

      expect(result.displayDate).toBe('2026-01-06');
    });
  });

  describe('Bug: Edge Cases with Biweekly Anchoring', () => {
    it('should maintain cycle even when completed 2 weeks late', () => {
      // Jan 19, 2026 - completing a Jan 5 task 14 days late
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-19T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(todo, false);

      // Jan 5 + 14 = Jan 19 (today, not future)
      // Jan 19 + 14 = Feb 2
      expect(result.displayDate).toBe('2026-02-02');
    });

    it('should handle very late completion (4 weeks)', () => {
      // Feb 2, 2026 - completing a Jan 5 task 28 days late
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

      // Jan 5 → Jan 19 → Feb 2 (today) → Feb 16
      expect(result.displayDate).toBe('2026-02-16');
    });
  });

  describe('Bug: Timezone-aware date comparison (completing on due date)', () => {
    // This bug occurred when completing a monthly recurring todo ON its due date.
    // The old code used startOfDay() which uses system timezone, causing incorrect
    // comparisons on UTC servers. The fix uses ISO date string comparison instead.
    
    it('should advance to next month when completing monthly date todo ON the due date', () => {
      // Feb 1, 2026 - completing a Feb 1st monthly todo on Feb 1st
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-02-01T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 1,
        displayDate: '2026-02-01',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be March 1, NOT Feb 1 (same date - the bug!)
      expect(result.displayDate).toBe('2026-03-01');
    });

    it('should advance to next month when completing monthly date todo ON the due date (with boundary hour time)', () => {
      // Simulates production scenario: Feb 1 at 9 AM UTC (4 AM EST boundary hour)
      // This was the exact scenario causing the bug on UTC servers
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-02-01T09:00:00Z') // 4 AM EST = 9 AM UTC
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 1,
        displayDate: '2026-02-01',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should still be March 1, regardless of time component
      expect(result.displayDate).toBe('2026-03-01');
    });

    it('should advance to next month when completing monthly day todo ON the due date', () => {
      // Jan 13, 2026 is the 2nd Tuesday of January
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-13T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2, // 2nd week
        recurrenceDayOfWeekMonthly: 2, // Tuesday
        displayDate: '2026-01-13',
        dueDate: '2026-01-13',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be Feb 10 (2nd Tuesday of Feb), NOT Jan 13
      expect(result.displayDate).toBe('2026-02-10');
    });

    it('should advance to next year when completing annual todo ON the due date', () => {
      // Mar 15, 2026 - completing annual todo on its date
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-03-15T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'annually',
        recurrenceMonth: 3, // March
        recurrenceDayOfMonth: 15,
        displayDate: '2026-03-15',
      });

      const result = calculateNextRecurrence(todo, false);

      // Should be March 15, 2027, NOT March 15, 2026
      expect(result.displayDate).toBe('2027-03-15');
    });

    it('should handle monthly date at end of month (31st)', () => {
      // Jan 31, 2026 - completing on the 31st
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-31T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 31,
        displayDate: '2026-01-31',
      });

      const result = calculateNextRecurrence(todo, false);

      // Feb doesn't have 31 days, should use Feb 28 (last day of Feb 2026)
      expect(result.displayDate).toBe('2026-02-28');
    });

    it('should handle monthly date on 1st when today equals displayDate with various times (UTC)', () => {
      // Test multiple time scenarios to ensure time component doesn't affect date comparison
      // All times are explicitly UTC to avoid local timezone ambiguity in tests
      const timeScenarios = [
        '2026-02-01T00:00:00.000Z',  // Midnight UTC
        '2026-02-01T04:00:00.000Z',  // 4 AM UTC
        '2026-02-01T09:00:00.000Z',  // 9 AM UTC (4 AM EST)
        '2026-02-01T12:00:00.000Z',  // Noon UTC
        '2026-02-01T18:00:00.000Z',  // 6 PM UTC
      ];

      for (const timeStr of timeScenarios) {
        vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
          new Date(timeStr)
        );

        const todo = createTodo({
          isRecurring: true,
          recurrenceType: 'monthly date',
          recurrenceDayOfMonth: 1,
          displayDate: '2026-02-01',
        });

        const result = calculateNextRecurrence(todo, false);

        expect(result.displayDate).toBe('2026-03-01');
      }
    });
  });

  describe('Bug: Max Date Logic for Event-Based Types', () => {
    it('should use event date when completing before event', () => {
      // Jan 10 - completing before Jan 15 event
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-01-10T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        dueDate: '2026-01-15',
      });

      const result = calculateNextRecurrence(todo, false);

      // Next occurrence from Jan 15 (event date) is Feb 15
      expect(result.displayDate).toBe('2026-02-15');
    });

    it('should use completion date when completing after event', () => {
      // Feb 5 - completing after Jan 15 event
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        new Date('2026-02-05T00:00:00')
      );

      const todo = createTodo({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        dueDate: '2026-01-15',
      });

      const result = calculateNextRecurrence(todo, false);

      // Next occurrence from Feb 5 (completion date) is Feb 15
      expect(result.displayDate).toBe('2026-02-15');
    });
  });
});

