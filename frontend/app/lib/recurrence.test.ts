import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateNextRecurrence } from './recurrence';
import type { Task } from '@/app/types/index';
import * as dateUtils from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

// The timezone and day boundary are parameters now; these tests pin them.
const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

// Mock the date utilities to have consistent test dates
vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getTodayForRecurrence: vi.fn(),
    getToday: vi.fn(),
  };
});


// Helper to create minimal task for testing
function createTask(overrides: Partial<Task>): Task {
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
      dateUtils.parseDate('2026-01-05', EST)
    );
    vi.mocked(dateUtils.getToday).mockReturnValue(
      dateUtils.parseDate('2026-01-05', EST)
    );
  });

  describe('Daily Recurrence', () => {
    it('should display today on initial creation', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: null,
      });

      const result = calculateNextRecurrence(task, EST, true);

      expect(result.displayDate).toBe('2026-01-05'); // Today
      expect(result.dueDate).toBe(null);
    });

    it('should schedule for tomorrow after completion', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-06'); // Tomorrow
      expect(result.dueDate).toBe(null);
    });

    it('should drift from actual completion date', () => {
      // Simulate completing on Jan 10 instead of Jan 5
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        dateUtils.parseDate('2026-01-10', EST)
      );

      const task = createTask({
        isRecurring: true,
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-11'); // Day after actual completion
    });
  });

  describe('Every X Days Recurrence', () => {
    it('should display today on initial creation', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 3,
      });

      const result = calculateNextRecurrence(task, EST, true);

      expect(result.displayDate).toBe('2026-01-05'); // Today
    });

    it('should schedule X days after completion', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 3,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-08'); // 3 days later
    });

    it('should work with 7 day interval', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 7,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-12'); // 7 days later
    });

    it('should return null if interval is missing', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: null,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe(null);
    });
  });

  describe('Weekly Recurrence - Critical Bug Fix', () => {
    it('should find next target weekday on initial creation (not today)', () => {
      // Today is Monday (1), create task for Wednesday (3)
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 3, // Wednesday
      });

      const result = calculateNextRecurrence(task, EST, true);

      expect(result.displayDate).toBe('2026-01-07'); // Next Wednesday
    });

    it('should schedule 7 days later when completed on target day', () => {
      // Today is Monday Jan 5, completing Monday task
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-12'); // Next Monday (7 days, NOT 14)
    });

    it('should find next target weekday when completed on different day', () => {
      // Today is Monday, but task is for Wednesday
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 3, // Wednesday
        displayDate: '2026-01-01',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-07'); // Next Wednesday
    });

    it('should work correctly for Sunday tasks', () => {
      // Today is Monday, create task for Sunday (7 in our format)
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 7, // Sunday
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-11'); // Next Sunday
    });

    it('should return null if recurrenceDayOfWeek is missing', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: null,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe(null);
    });
  });

  describe('Biweekly Recurrence - Critical Bug Fix', () => {
    it('should find next target weekday on initial creation', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1, // Monday
      });

      const result = calculateNextRecurrence(task, EST, true);

      // nextDay() skips today, so next Monday is 7 days away
      expect(result.displayDate).toBe('2026-01-12'); // Next Monday
    });

    it('should maintain strict 14-day cycle from displayDate', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-01-19'); // Jan 5 + 14 days
    });

    it('should maintain schedule even when completed 5 days late', () => {
      // Completed on Jan 10, but displayDate was Jan 5
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        dateUtils.parseDate('2026-01-10', EST)
      );

      const task = createTask({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Should maintain original cycle: Jan 5 + 14 = Jan 19
      expect(result.displayDate).toBe('2026-01-19');
    });

    it('should skip to next valid cycle if completed very late', () => {
      // Completed on Feb 2, displayDate was Jan 5
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        dateUtils.parseDate('2026-02-02', EST)
      );

      const task = createTask({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Jan 5 + 14 = Jan 19 (past)
      // Jan 19 + 14 = Feb 2 (today, not future)
      // Feb 2 + 14 = Feb 16
      expect(result.displayDate).toBe('2026-02-16');
    });

    it('should return null if recurrenceDayOfWeek is missing', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: null,
        displayDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe(null);
    });

    it('should return null if displayDate is missing', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1,
        displayDate: null,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe(null);
    });
  });

  describe('Monthly Date Recurrence', () => {
    it('should schedule for same day next month', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        dueDate: '2026-01-15',
        displayDateOffset: 7, // Need offset to get both dates
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.dueDate).toBe('2026-02-15');
      expect(result.displayDate).toBe('2026-02-08'); // 7 days before
    });

    it('should set both dueDate and displayDate with offset', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-08',
        dueDate: '2026-01-15',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.dueDate).toBe('2026-02-15');
      expect(result.displayDate).toBe('2026-02-08'); // 7 days before
    });

    it('should only set displayDate without offset', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        displayDate: '2026-01-15',
        displayDateOffset: 0,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2026-02-15');
      expect(result.dueDate).toBe(null);
    });

    it('should use last day of month when target day does not exist (Feb 31)', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 31,
        displayDate: '2026-01-31',
        dueDate: '2026-01-31',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Feb 2026 has 28 days (not a leap year)
      expect(result.displayDate).toBe('2026-02-28');
    });

    it('should handle Feb 29 in leap year', () => {
      // 2028 is a leap year
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        dateUtils.parseDate('2028-01-31', EST)
      );

      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 29,
        displayDate: '2028-01-29',
        dueDate: '2028-01-29',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2028-02-29'); // Leap year!
    });
  });

  describe('Monthly Day Recurrence', () => {
    it('should schedule for 2nd Tuesday of next month', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2, // 2nd week
        recurrenceDayOfWeekMonthly: 2, // Tuesday (1=Mon, 2=Tue, etc.)
        displayDate: '2026-01-06', // 1 week before 2nd Tuesday
        dueDate: '2026-01-13',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.dueDate).toBe('2026-02-10'); // 2nd Tuesday of Feb
      expect(result.displayDate).toBe('2026-02-03'); // 7 days before
    });

    it('should handle last Friday of month', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: -1, // Last week
        recurrenceDayOfWeekMonthly: 5, // Friday (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri)
        displayDate: '2026-01-23', // Week before last Friday
        dueDate: '2026-01-30',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.dueDate).toBe('2026-02-27'); // Last Friday of Feb
      expect(result.displayDate).toBe('2026-02-20'); // 7 days before
    });

    it('should work with offset', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 2, // Tuesday
        displayDate: '2026-01-06',
        dueDate: '2026-01-13',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.dueDate).toBe('2026-02-10');
      expect(result.displayDate).toBe('2026-02-03'); // 7 days before
    });
  });

  describe('Annually Recurrence', () => {
    it('should schedule for same date next year', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'annually',
        recurrenceMonth: 3, // March
        recurrenceDayOfMonth: 15,
        displayDate: '2026-03-15',
        dueDate: '2026-03-15',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe('2027-03-15');
    });

    it('should handle Feb 29 in non-leap year', () => {
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
        dateUtils.parseDate('2027-02-28', EST)
      );

      const task = createTask({
        isRecurring: true,
        recurrenceType: 'annually',
        recurrenceMonth: 2, // February
        recurrenceDayOfMonth: 29,
        displayDate: '2026-02-28',
        dueDate: '2026-02-28',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // 2028 is a leap year, so Feb 29 exists
      expect(result.displayDate).toBe('2028-02-29');
    });

    it('should work with offset', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'annually',
        recurrenceMonth: 3,
        recurrenceDayOfMonth: 15,
        displayDate: '2026-03-08',
        dueDate: '2026-03-15',
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.dueDate).toBe('2027-03-15');
      expect(result.displayDate).toBe('2027-03-08');
    });
  });

  describe('Non-recurring tasks', () => {
    it('should return null dates for non-recurring tasks', () => {
      const task = createTask({
        isRecurring: false,
        recurrenceType: 'none',
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe(null);
      expect(result.dueDate).toBe(null);
    });
  });

  describe('Astronomical Event Recurrence', () => {
    // These pin the *exact* event date, not just "changed" or the right month.
    // "Today" is mocked to 2026-01-05 (beforeEach). Every expected date is the real
    // astronomical event in the user's zone, cross-checked against the raw UTC
    // instant from astronomy-engine — the ephemeris is deterministic, so a change
    // here means the date math (the zone conversion, the boundary, an off-by-one)
    // regressed, which is precisely the class of bug that is hard to spot by eye.
    it('schedules the next full moon on its own calendar day', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'full moon',
        displayDate: '2026-01-05',
        dueDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Full moon 2026-02-01 (18:09 UTC → 13:09 EST), the first after 2026-01-05.
      expect(result.displayDate).toBe('2026-02-01');
    });

    it('schedules the next new moon on its own calendar day', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'new moon',
        displayDate: '2026-01-05',
        dueDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // New moon 2026-01-18 (19:52 UTC → 14:52 EST).
      expect(result.displayDate).toBe('2026-01-18');
    });

    // Regression: the search used to start at addDays(comparisonDate, 1) — a day
    // added to the 4am *boundary instant*, so it began at tomorrow-4am and skipped
    // any moon in tomorrow's 00:00–04:00 window, which toISODate still files as
    // tomorrow. That jumped the task a whole lunar month. These pin real moons in
    // that window; the buggy code returns the *following* month's moon in every zone.
    it('does not skip a full moon falling just after midnight on the target day', () => {
      // Real full moon: 2026-08-28 00:19 EDT (2026-08-28T04:19Z). "Today" is the
      // 4am-EDT boundary instant of 2026-08-27 — what getTodayForRecurrence returns.
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(new Date('2026-08-27T08:00:00.000Z'));
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'full moon',
        displayDate: '2026-08-27',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // The moon's own calendar day — not 2026-09-26, a lunar month later.
      expect(result.displayDate).toBe('2026-08-28');
    });

    it('does not skip a new moon falling just after midnight on the target day', () => {
      // Real new moon: 2026-11-09 02:02 EST (2026-11-09T07:02Z). Today = 4am-EST
      // boundary instant of 2026-11-08.
      vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(new Date('2026-11-08T09:00:00.000Z'));
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'new moon',
        displayDate: '2026-11-08',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Not 2026-12-08, a lunar month later.
      expect(result.displayDate).toBe('2026-11-09');
    });

    it('advances the spring equinox to next year when completed on this year’s', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'spring equinox',
        displayDate: '2026-03-20',
        dueDate: '2026-03-20', // 2026 equinox; completing on it must roll to 2027
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Spring equinox 2027-03-20 (20:24 UTC → 16:24 EDT).
      expect(result.displayDate).toBe('2027-03-20');
    });

    it('advances the summer solstice to next year when completed on this year’s', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'summer solstice',
        displayDate: '2026-06-21',
        dueDate: '2026-06-21',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Summer solstice 2027-06-21 (14:10 UTC → 10:10 EDT).
      expect(result.displayDate).toBe('2027-06-21');
    });

    it('advances the autumn equinox to next year when completed on this year’s', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'autumn equinox',
        displayDate: '2026-09-22',
        dueDate: '2026-09-23', // Actual 2026 autumn equinox date
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Autumn equinox 2027-09-23 (06:01 UTC → 02:01 EDT). The 2am-local time is
      // the interesting case: it is safely past midnight, so the day is 09-23, not
      // 09-22 — an off-by-one in the zone conversion would surface right here.
      expect(result.displayDate).toBe('2027-09-23');
    });

    it('advances the winter solstice to next year when completed on this year’s', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'winter solstice',
        displayDate: '2025-12-21',
        dueDate: '2025-12-21',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // Winter solstice 2026-12-21 (20:50 UTC → 15:50 EST).
      expect(result.displayDate).toBe('2026-12-21');
    });

    it('schedules "every season" to the next equinox/solstice after today', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'every season',
        displayDate: '2026-01-05',
        dueDate: '2026-01-05',
      });

      const result = calculateNextRecurrence(task, EST, false);

      // From 2026-01-05 the next season is the spring equinox 2026-03-20 (10:45 EST).
      expect(result.displayDate).toBe('2026-03-20');
    });

    it('applies the offset: dueDate on the event, displayDate exactly N days before', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'full moon',
        displayDate: '2025-12-29',
        dueDate: '2026-01-05', // the event anchor; next full moon after it is 2026-02-01
        displayDateOffset: 7,
      });

      const result = calculateNextRecurrence(task, EST, false);

      // dueDate = the full moon 2026-02-01; displayDate = 7 days earlier, exactly.
      expect(result.dueDate).toBe('2026-02-01');
      expect(result.displayDate).toBe('2026-01-25');
    });

    it('with no offset, puts the event on displayDate and leaves dueDate null', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'full moon',
        displayDate: '2026-01-05',
        displayDateOffset: 0,
      });

      const result = calculateNextRecurrence(task, EST, false);

      // The full moon itself, no separate due date.
      expect(result.displayDate).toBe('2026-02-01');
      expect(result.dueDate).toBe(null);
    });
  });

  describe('Validation errors', () => {
    it('should return null dates for invalid configuration', () => {
      const task = createTask({
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: null, // Missing required field
      });

      const result = calculateNextRecurrence(task, EST, false);

      expect(result.displayDate).toBe(null);
    });
  });
});

