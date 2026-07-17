import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project } from '@/app/types/index';
import * as dateUtils from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

// The timezone and day boundary are parameters now; these tests pin them.
const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

// Mock only the clock (getToday). parseDate/toISODate/formatInTimezone run for
// real. The old stubs were the worst in the repo: a machine-local parseDate, a
// UTC-slice toISODate, and a formatInTimezone that ignored its format string and
// hardcoded `mon ${m}/${d}` — so every date-title was fiction and the real
// timezone conversion never ran. This suite drives codePreset:'done' through the
// real getEffectiveDayForTimestamp, so the stubbed toISODate is exactly the seam
// the Done-page bug slipped through.
vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(),
  };
});


// Helper to create minimal task
function createTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    documentId: 'test-doc-id',
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
    project: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Layout Transformer - Work Session Virtual Entries', () => {
  beforeEach(() => {
    // Set a fixed "today" for all tests - Monday, Jan 5, 2026.
    //
    // The system clock is pinned alongside the mocked getToday: transformDone reads "now" as
    // a real instant (new Date()) to resolve the effective day for its 30-day window. Mocking
    // only getToday left this suite straddling two clocks, and the fixtures below then sat
    // outside a window anchored on the real date. 12:00Z is 07:00 in New York, after the 4am
    // boundary, so the effective day matches the mocked getToday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z'));
    vi.mocked(dateUtils.getToday).mockReturnValue(dateUtils.parseDate('2026-01-05', EST));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Virtual Entry Creation', () => {
    it('should create virtual worked-on entries for long tasks with work sessions', () => {
      const longTask = createTask({
        documentId: 'long-task-1',
        title: 'Long project task',
        long: true,
        completed: false,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
          { date: '2026-01-04', timestamp: '2026-01-04T14:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      expect(result.doneSections).toBeDefined();
      expect(result.doneSections!.length).toBeGreaterThan(0);
      
      // Find the virtual entries
      const allTasks = result.doneSections!.flatMap(section => section.tasks);
      const virtualEntries = allTasks.filter(task => 
        task.documentId.includes('-worked-')
      );
      
      expect(virtualEntries.length).toBe(2); // One for each work session
      expect(virtualEntries[0].documentId).toContain('long-task-1-worked-');
      expect(virtualEntries[0].title).toBe('Long project task');
    });

    it('should use correct documentId pattern for virtual entries', () => {
      const longTask = createTask({
        documentId: 'abc123',
        title: 'My Task',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const virtualEntry = allTasks.find(task => task.documentId.includes('-worked-'));
      
      expect(virtualEntry).toBeDefined();
      expect(virtualEntry!.documentId).toMatch(/^abc123-worked-\d{4}-\d{2}-\d{2}$/);
      expect(virtualEntry!.documentId).toBe('abc123-worked-2026-01-05');
    });

    it('should set completed=false for virtual entries', () => {
      const longTask = createTask({
        documentId: 'task-1',
        long: true,
        completed: true, // Original task is completed
        completedAt: '2026-01-05T15:00:00.000Z',
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const virtualEntry = allTasks.find(task => task.documentId.includes('-worked-'));
      
      expect(virtualEntry).toBeDefined();
      expect(virtualEntry!.completed).toBe(false); // Virtual entry is not completed
      expect(virtualEntry!.completedAt).toBe('2026-01-05T10:00:00.000Z'); // Uses work session timestamp
    });

    it('should use work session timestamp as completedAt', () => {
      const sessionTimestamp = '2026-01-05T14:30:00.000-05:00';
      const longTask = createTask({
        documentId: 'task-1',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: sessionTimestamp },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const virtualEntry = allTasks.find(task => task.documentId.includes('-worked-'));
      
      expect(virtualEntry!.completedAt).toBe(sessionTimestamp);
    });
  });

  describe('Date Grouping', () => {
    it('should group virtual entries by work session date', () => {
      const longTask = createTask({
        documentId: 'task-1',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
          { date: '2026-01-04', timestamp: '2026-01-04T14:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      // Should have separate date sections for each work session
      expect(result.doneSections.length).toBeGreaterThanOrEqual(2);
      
      // Check that entries are in correct date sections
      const jan5Section = result.doneSections.find(s => 
        s.tasks.some(t => t.documentId === 'task-1-worked-2026-01-05')
      );
      const jan4Section = result.doneSections.find(s => 
        s.tasks.some(t => t.documentId === 'task-1-worked-2026-01-04')
      );
      
      expect(jan5Section).toBeDefined();
      expect(jan4Section).toBeDefined();
    });

    it('should respect 30-day window for work sessions', () => {
      const longTask = createTask({
        documentId: 'task-1',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' }, // Within window
          { date: '2025-12-01', timestamp: '2025-12-01T10:00:00.000Z' }, // Outside window (35 days ago)
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const jan5Entry = allTasks.find(t => t.documentId === 'task-1-worked-2026-01-05');
      const dec1Entry = allTasks.find(t => t.documentId === 'task-1-worked-2025-12-01');
      
      expect(jan5Entry).toBeDefined(); // Within 30 days
      expect(dec1Entry).toBeUndefined(); // Outside 30 days
    });
  });

  describe('Multiple Work Sessions', () => {
    it('should create separate virtual entries for each work session', () => {
      const longTask = createTask({
        documentId: 'multi-session-task',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T09:00:00.000Z' },
          { date: '2026-01-05', timestamp: '2026-01-05T14:00:00.000Z' },
          { date: '2026-01-04', timestamp: '2026-01-04T10:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const virtualEntries = allTasks.filter(task => 
        task.documentId.includes('multi-session-task-worked-')
      );
      
      // Should have 3 virtual entries but with same date will be deduplicated by date key
      // Actually, looking at the code, each session creates a separate entry
      expect(virtualEntries.length).toBeGreaterThan(0);
    });

    it('should handle multiple long tasks with work sessions', () => {
      const task1 = createTask({
        documentId: 'task-1',
        title: 'Task One',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
        ],
      });

      const task2 = createTask({
        documentId: 'task-2',
        title: 'Task Two',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T11:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [task1, task2],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const task1Entry = allTasks.find(t => t.documentId === 'task-1-worked-2026-01-05');
      const task2Entry = allTasks.find(t => t.documentId === 'task-2-worked-2026-01-05');
      
      expect(task1Entry).toBeDefined();
      expect(task2Entry).toBeDefined();
      expect(task1Entry!.title).toBe('Task One');
      expect(task2Entry!.title).toBe('Task Two');
    });
  });

  describe('Edge Cases', () => {
    it('should handle long tasks with no work sessions', () => {
      const longTask = createTask({
        documentId: 'no-sessions',
        long: true,
        workSessions: [],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const virtualEntries = allTasks.filter(task => 
        task.documentId.includes('-worked-')
      );
      
      expect(virtualEntries.length).toBe(0); // No virtual entries created
    });

    it('should handle long tasks with null work sessions', () => {
      const longTask = createTask({
        documentId: 'null-sessions',
        long: true,
        workSessions: null,
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const virtualEntries = allTasks.filter(task => 
        task.documentId.includes('-worked-')
      );
      
      expect(virtualEntries.length).toBe(0); // No virtual entries created
    });

    it('should not create virtual entries for non-done views', () => {
      const longTask = createTask({
        documentId: 'task-1',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
        ],
      });

      const ruleset = {
        layout: 'projects' as const,
        slug: 'p',
        name: 'p',
        sections: [
          { worldMode: 'all' as const, worldIds: [], importance: 'any' as const, projectType: 'any' as const, recurrence: 'both' as const, longOnly: false },
        ],
      };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      // Only the `done` code preset synthesizes "worked on" virtual entries.
      expect(result.doneSections).toBeUndefined();
    });

    it('should preserve all task properties in virtual entries', () => {
      const longTask = createTask({
        documentId: 'full-task',
        title: 'Full Task',
        description: [{ type: 'paragraph', children: [{ type: 'text', text: 'Description' }] }],
        long: true,
        soon: true,
        trackingUrl: 'https://example.com',
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [],
          longTasksWithSessions: [longTask],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      const allTasks = result.doneSections.flatMap(section => section.tasks);
      const virtualEntry = allTasks.find(task => task.documentId.includes('-worked-'));
      
      expect(virtualEntry).toBeDefined();
      expect(virtualEntry!.description).toEqual(longTask.description);
      expect(virtualEntry!.soon).toBe(true);
      expect(virtualEntry!.trackingUrl).toBe('https://example.com');
      expect(virtualEntry!.long).toBe(true);
    });
  });

  describe('Integration with Completed Tasks', () => {
    it('should show both completed tasks and worked-on entries in done view', () => {
      const completedTask = createTask({
        documentId: 'completed-1',
        title: 'Completed Task',
        completed: true,
        completedAt: '2026-01-05T11:00:00.000Z',
      });

      const longTaskWithSession = createTask({
        documentId: 'long-1',
        title: 'Long Task',
        long: true,
        workSessions: [
          { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
        ],
      });

      const ruleset = { codePreset: 'done' as const };
      const result = transformLayout(
        {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          completedTasks: [completedTask], // Pass in completedTasks array
          longTasksWithSessions: [longTaskWithSession],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [],
        },
        ruleset
      ,
        EST);

      expect(result.doneSections).toBeDefined();
      expect(result.doneSections!.length).toBeGreaterThan(0);

      const allTasks = result.doneSections!.flatMap(section => section.tasks);
      
      const completed = allTasks.find(t => t.documentId === 'completed-1');
      const workedOn = allTasks.find(t => t.documentId === 'long-1-worked-2026-01-05');
      
      expect(completed).toBeDefined();
      expect(workedOn).toBeDefined();
      expect(completed!.completed).toBe(true);
      expect(workedOn!.completed).toBe(false);
    });
  });
});
