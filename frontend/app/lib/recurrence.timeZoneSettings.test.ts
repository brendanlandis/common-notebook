import { describe, it, expect, afterEach, vi } from 'vitest';
import { calculateNextRecurrence } from './recurrence';
import type { Task } from '@/app/types/index';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Guards the bug that motivated threading `TimeZoneSettings`: `calculateNextRecurrence`
 * is imported by `api/tasks/[documentId]/complete` and `.../skip` on the server and
 * by `todo/components/TaskForm` on the client. Both used to read the timezone and
 * day boundary from module-level caches that only the browser ever primed, so the
 * server computed in EST at boundary 0 and the client at whatever it had — and
 * completing a recurring task wrote a next-due-date the form never predicted.
 *
 * Deliberately does NOT mock ./dateUtils. The mocked suites pin
 * `getTodayForRecurrence`, which is exactly the seam where the bug lived, so they
 * cannot catch a regression here.
 */

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
    isRecurring: true,
    recurrenceType: 'daily',
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    project: null,
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
  } as Task;
}

const settings = (timezone: string, dayBoundaryHour: number): TimeZoneSettings => ({
  timezone,
  dayBoundaryHour,
});

describe('calculateNextRecurrence — time settings propagate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves 2am differently for boundary 0 vs 4 — the server/client split', () => {
    // 2am EST Tuesday: before a 4am boundary (so "today" is Monday), after a
    // midnight one (so "today" is Tuesday).
    vi.setSystemTime(new Date('2026-01-06T02:00:00-05:00'));
    const task = createTask({ recurrenceType: 'daily' });

    const atMidnightBoundary = calculateNextRecurrence(task, settings('America/New_York', 0));
    const atFourAmBoundary = calculateNextRecurrence(task, settings('America/New_York', 4));

    // What the server used to compute (boundary 0, never primed): Wednesday.
    expect(atMidnightBoundary.displayDate).toBe('2026-01-07');
    // What the user's stored boundary of 4 actually means: Tuesday.
    expect(atFourAmBoundary.displayDate).toBe('2026-01-06');
    expect(atMidnightBoundary.displayDate).not.toBe(atFourAmBoundary.displayDate);
  });

  it('honours the boundary the caller passes, whichever caller it is', () => {
    vi.setSystemTime(new Date('2026-01-06T02:00:00-05:00'));
    const task = createTask({ recurrenceType: 'daily' });
    const stored = settings('America/New_York', 4);

    // The server routes and TaskForm now pass the same resolved settings, so the
    // same input has to yield the same dates for either caller.
    const asServerWouldCompute = calculateNextRecurrence(task, stored);
    const asClientWouldCompute = calculateNextRecurrence(task, stored);

    expect(asServerWouldCompute).toEqual(asClientWouldCompute);
    expect(asServerWouldCompute.displayDate).toBe('2026-01-06');
  });

  it('resolves the same instant differently per timezone', () => {
    // 05:00 EST Tuesday is 02:00 PST Tuesday. With a 4am boundary the east coast
    // is past it and the west coast is not, so "tomorrow" differs by a day.
    vi.setSystemTime(new Date('2026-01-06T05:00:00-05:00'));
    const task = createTask({ recurrenceType: 'daily' });

    expect(calculateNextRecurrence(task, settings('America/New_York', 4)).displayDate).toBe(
      '2026-01-07'
    );
    expect(calculateNextRecurrence(task, settings('America/Los_Angeles', 4)).displayDate).toBe(
      '2026-01-06'
    );
  });

  it('threads settings through event-based recurrence too', () => {
    vi.setSystemTime(new Date('2026-01-06T02:00:00-05:00'));
    // Day 20 of the month, shown on the day of the event.
    const task = createTask({ recurrenceType: 'monthly date', recurrenceDayOfMonth: 20 });

    expect(calculateNextRecurrence(task, settings('America/New_York', 4)).displayDate).toBe(
      '2026-01-20'
    );
  });
});
