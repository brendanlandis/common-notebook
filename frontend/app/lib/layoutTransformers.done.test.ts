import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import { findCodePreset } from './views';
import type { Task } from '@/app/types/index';
import type { TimeZoneSettings } from './timeZoneSettings';

// This suite deliberately does NOT mock ./dateUtils.
//
// layoutTransformers.workSessions.test.ts does, and that mock is why this bug shipped: it
// pins dayBoundaryHour: 4 but stubs parseDate as system-local midnight and toISODate as a
// reader of UTC components — a pair that does not round-trip for any non-UTC zone. That is
// the exact seam transformDone's day-boundary bug lived in, so the mocked suite could never
// see it. Only the real (Temporal-backed) timezone conversion can.
//
// Every case below is a real instant (Z-suffixed) with the zone pinned in settings, so these
// assertions must hold whatever timezone the machine running them is in. Run under at least
// TZ=UTC, TZ=America/New_York and TZ=Asia/Kolkata.

const NYC_3AM: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 3 };
const NYC_MIDNIGHT: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 0 };

// 2026-07-17T18:00Z is 14:00 in New York (EDT, UTC-4) — comfortably after any boundary
// under test, so "today" is 2026-07-17 and "yesterday" is 2026-07-16.
const NOW = new Date('2026-07-17T18:00:00.000Z');

function createTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    documentId: 'test-doc-id',
    title: 'Test task',
    description: [],
    completed: true,
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

// The real ruleset the /todo/view/done route resolves, rather than a hand-built literal.
const DONE_RULESET = findCodePreset('done')!;

function doneSectionsFor(completedTasks: Task[], settings: TimeZoneSettings) {
  return transformLayout(
    {
      projects: [],
      categoryGroups: [],
      incidentals: [],
      completedTasks,
      longTasksWithSessions: [],
      recurringProjects: [],
      recurringCategoryGroups: [],
      recurringIncidentals: [],
    },
    DONE_RULESET,
    settings
  ).doneSections!;
}

/** The title of the section a task was filed under, or undefined if it never appeared. */
function sectionTitleOf(completedTasks: Task[], documentId: string, settings: TimeZoneSettings) {
  return doneSectionsFor(completedTasks, settings).find((section) =>
    section.tasks.some((task) => task.documentId === documentId)
  )?.title;
}

/** One completed task at `completedAt`; returns the section title it lands in. */
function sectionForCompletionAt(completedAt: string, settings: TimeZoneSettings) {
  const task = createTask({ documentId: 'subject', completedAt });
  return sectionTitleOf([task], 'subject', settings);
}

describe('Layout Transformer - done preset day bucketing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with a 3am day boundary in New York', () => {
    it('files a task completed just after midnight under yesterday', () => {
      // 00:30 in New York on 7/17. Before the 3am boundary, so it belongs to 7/16.
      expect(sectionForCompletionAt('2026-07-17T04:30:00.000Z', NYC_3AM)).toBe('yesterday');
    });

    it('files a task completed in the evening under that same day', () => {
      // 21:00 in New York on 7/16 — the UTC calendar has already rolled over to 7/17,
      // which is what used to push this task a day early, out of "yesterday" entirely.
      expect(sectionForCompletionAt('2026-07-17T01:00:00.000Z', NYC_3AM)).toBe('yesterday');
    });

    it('groups an after-midnight and an evening completion into one section', () => {
      // The two windows that used to break in opposite directions: 21:00 on 7/16 and
      // 00:30 on 7/17 are the same effective day, so they belong in the same batch.
      const evening = createTask({ documentId: 'evening', completedAt: '2026-07-17T01:00:00.000Z' });
      const afterMidnight = createTask({
        documentId: 'after-midnight',
        completedAt: '2026-07-17T04:30:00.000Z',
      });

      const sections = doneSectionsFor([evening, afterMidnight], NYC_3AM);
      const yesterday = sections.filter((section) => section.title === 'yesterday');

      expect(yesterday).toHaveLength(1);
      expect(yesterday[0].tasks.map((task) => task.documentId).sort()).toEqual([
        'after-midnight',
        'evening',
      ]);
    });

    it('files a task completed at the boundary hour under today', () => {
      // 03:00 in New York on 7/17. The boundary is inclusive: 3 is not < 3.
      expect(sectionForCompletionAt('2026-07-17T07:00:00.000Z', NYC_3AM)).toBe('today');
    });

    it('files a task completed one hour before the boundary under yesterday', () => {
      // 02:00 in New York on 7/17.
      expect(sectionForCompletionAt('2026-07-17T06:00:00.000Z', NYC_3AM)).toBe('yesterday');
    });

    it('files a late-night task under the day it started', () => {
      // 23:00 in New York on 7/16.
      expect(sectionForCompletionAt('2026-07-17T03:00:00.000Z', NYC_3AM)).toBe('yesterday');
    });

    it('files a midday task under today', () => {
      // 11:00 in New York on 7/17.
      expect(sectionForCompletionAt('2026-07-17T15:00:00.000Z', NYC_3AM)).toBe('today');
    });

    it('labels an older completion with its own effective day, not a shifted one', () => {
      // 21:00 in New York on 7/14 — an evening completion far enough back to carry a
      // date label rather than today/yesterday.
      expect(sectionForCompletionAt('2026-07-15T01:00:00.000Z', NYC_3AM)).toBe('tue 07/14');
    });
  });

  describe('with a midnight day boundary', () => {
    it('never shifts a task off its own calendar day', () => {
      // 00:30 in New York on 7/17. With no boundary, this is simply today.
      expect(sectionForCompletionAt('2026-07-17T04:30:00.000Z', NYC_MIDNIGHT)).toBe('today');
    });

    it('still keeps an evening task on its own day', () => {
      // 21:00 in New York on 7/16.
      expect(sectionForCompletionAt('2026-07-17T01:00:00.000Z', NYC_MIDNIGHT)).toBe('yesterday');
    });
  });

  describe('window', () => {
    it('keeps a completion inside the 30-day window and drops one beyond it', () => {
      // Effective today is 7/17; the window is today + 29 prior, so 6/18 is the oldest day kept.
      const oldest = createTask({ documentId: 'oldest', completedAt: '2026-06-18T16:00:00.000Z' });
      const tooOld = createTask({ documentId: 'too-old', completedAt: '2026-06-17T16:00:00.000Z' });

      expect(sectionTitleOf([oldest], 'oldest', NYC_3AM)).toBe('thu 06/18');
      expect(sectionTitleOf([tooOld], 'too-old', NYC_3AM)).toBeUndefined();
    });
  });

  // R2: the upcoming panel used addDays(getToday(), i) on an instant, doing the
  // arithmetic in the machine's calendar. On a UTC server serving a New York user
  // during fall-back week it emitted Nov 1 under two headings and dropped Nov 4.
  // Pinned to the fall-back week so a machine-zone regression can't hide.
  describe('upcoming panel across fall-back', () => {
    // 2026-10-30 14:00 EDT; US DST ends 2026-11-01 02:00. "Today" is 2026-10-30, so
    // the next four days span the transition: 10-31, 11-01, 11-02, 11-03.
    const NOW_FALLBACK = new Date('2026-10-30T18:00:00.000Z');
    const NYC: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };
    const upcomingDays = ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'];

    beforeEach(() => vi.setSystemTime(NOW_FALLBACK));

    function upcomingFor(upcomingTasks: Task[]) {
      return transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
          upcomingTasks,
        },
        DONE_RULESET,
        NYC
      ).upcomingTasksByDay!;
    }

    it('files each of the next four days under exactly one section, none duplicated or dropped', () => {
      const tasks = upcomingDays.map((d) =>
        createTask({ documentId: `up-${d}`, completed: false, displayDate: d })
      );
      const panel = upcomingFor(tasks);

      expect(panel).toHaveLength(4);
      // Each day's task appears in its own section, at the expected index, exactly once.
      upcomingDays.forEach((d, i) => {
        const holding = panel.filter((s) => s.tasks.some((t) => t.documentId === `up-${d}`));
        expect(holding, `${d} should be in exactly one section`).toHaveLength(1);
        expect(panel[i].tasks.map((t) => t.documentId)).toEqual([`up-${d}`]);
      });
    });

    it('labels the first upcoming day "tomorrow"', () => {
      expect(upcomingFor([])[0].title).toBe('tomorrow');
    });
  });
});
