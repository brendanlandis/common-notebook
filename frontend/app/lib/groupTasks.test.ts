import { describe, it, expect } from 'vitest';
import { groupTasksForLayout } from './groupTasks';
import { parseDate } from './dateUtils';
import type { Task } from '@/app/types/index';
import type { TimeZoneSettings } from './timeZoneSettings';

// No mock of ./dateUtils — the whole point is to exercise the real parseDate the
// gate depends on. The equal-day case below only round-trips under the real
// timezone conversion, so this must hold in every machine zone (run test:zones).
const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

function createTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    documentId: 'task',
    title: 'Task',
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
    project: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    publishedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const ids = (tasks: Task[]) => tasks.map((t) => t.documentId).sort();

describe('groupTasksForLayout — recurring displayDate gate', () => {
  // Midnight 2026-07-17 in New York, as a real instant — the same kind of value the
  // callers pass (getToday / getTodayForRecurrence).
  const today = parseDate('2026-07-17', EST);

  const noDisplay = createTask({ documentId: 'r-no-display', isRecurring: true });
  const startsToday = createTask({ documentId: 'r-today', isRecurring: true, displayDate: '2026-07-17' });
  const startedYesterday = createTask({ documentId: 'r-past', isRecurring: true, displayDate: '2026-07-16' });
  const startsTomorrow = createTask({ documentId: 'r-future', isRecurring: true, displayDate: '2026-07-18' });
  const nonRecurring = createTask({ documentId: 'plain', isRecurring: false });

  const all = [noDisplay, startsToday, startedYesterday, startsTomorrow, nonRecurring];

  it('includes recurring tasks with no displayDate, or one on/before today; excludes future ones', () => {
    const grouped = groupTasksForLayout(all, [], today, EST);
    // These are all project-less, so they land in recurringIncidentals.
    expect(ids(grouped.recurringIncidentals)).toEqual(['r-no-display', 'r-past', 'r-today']);
  });

  it('files a recurring task whose displayDate equals today under the current day (boundary, zone-sensitive)', () => {
    const grouped = groupTasksForLayout([startsToday], [], today, EST);
    expect(ids(grouped.recurringIncidentals)).toEqual(['r-today']);
  });

  it('still reports the future-dated recurring task in the unfiltered set (for recurring review)', () => {
    const grouped = groupTasksForLayout(all, [], today, EST);
    expect(ids(grouped.allRecurringIncidentals)).toEqual(['r-future', 'r-no-display', 'r-past', 'r-today']);
  });

  it('keeps non-recurring tasks out of the recurring buckets', () => {
    const grouped = groupTasksForLayout(all, [], today, EST);
    expect(ids(grouped.incidentals)).toContain('plain');
    expect(ids(grouped.recurringIncidentals)).not.toContain('plain');
  });
});
