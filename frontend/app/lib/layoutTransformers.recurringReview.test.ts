import { describe, it, expect, beforeEach } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { RawTaskData } from './layoutTransformers';
import type { LayoutRuleset, Task, Project, RecurrenceType } from '@/app/types/index';

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
    category: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    project: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    publishedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Helper to create a minimal project
function createProject(overrides: Partial<Project>): Project {
  return {
    id: 1,
    documentId: 'project-1',
    title: 'Test Project',
    description: [],
    world: 'life stuff',
    importance: 'normal',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    publishedAt: '2024-01-01T00:00:00Z',
    tasks: [],
    ...overrides,
  };
}

describe('layoutTransformers - recurring-review', () => {
  let recurringReviewRuleset: LayoutRuleset;

  beforeEach(() => {
    recurringReviewRuleset = {
      id: 'recurring',
      name: 'recurring',
      showRecurring: true,
      showNonRecurring: false,
      visibleWorlds: null,
      visibleCategories: null,
      sortBy: 'alphabetical',
      groupBy: 'recurring-review',
    };
  });

  describe('basic functionality', () => {
    it('should return empty structure when there are no recurring tasks', () => {
      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      expect(result.recurringReviewSections).toBeDefined();
      expect(result.recurringReviewSections?.size).toBe(0);
    });

    it('should group tasks by recurrence type', () => {
      const dailyTask = createTask({
        documentId: 'task-1',
        title: 'Daily task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const weeklyTask = createTask({
        documentId: 'task-2',
        title: 'Weekly task',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
        completed: false,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [dailyTask, weeklyTask],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      // Incidentals only appear in recurringReviewIncidentals, not sections
      expect(result.recurringReviewIncidentals?.size).toBe(2);
      expect(result.recurringReviewIncidentals?.has('daily')).toBe(true);
      expect(result.recurringReviewIncidentals?.has('weekly')).toBe(true);
      expect(result.recurringReviewIncidentals?.get('daily')?.length).toBe(1);
      expect(result.recurringReviewIncidentals?.get('weekly')?.length).toBe(1);
    });

    it('should exclude completed recurring tasks', () => {
      const incompleteTask = createTask({
        documentId: 'task-1',
        title: 'Incomplete task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const completedTask = createTask({
        documentId: 'task-2',
        title: 'Completed task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: true,
        completedAt: '2024-01-01T12:00:00Z',
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [incompleteTask, completedTask],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const dailyIncidentals = result.recurringReviewIncidentals?.get('daily');
      expect(dailyIncidentals?.length).toBe(1);
      expect(dailyIncidentals?.[0].documentId).toBe('task-1');
    });
  });

  describe('organization within recurrence types', () => {
    it('should organize tasks by project, then category, then incidentals', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const projectTask = createTask({
        documentId: 'task-1',
        title: 'Project task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project,
      });

      const categoryTask = createTask({
        documentId: 'task-2',
        title: 'Category task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const incidentalTask = createTask({
        documentId: 'task-3',
        title: 'Incidental task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, tasks: [projectTask] }],
        recurringCategoryGroups: [
          {
            title: 'home chores',
            tasks: [categoryTask],
          },
        ],
        recurringIncidentals: [incidentalTask],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const dailySections = result.recurringReviewSections?.get('daily');
      const dailyIncidentals = result.recurringReviewIncidentals?.get('daily');

      expect(dailySections?.length).toBe(2); // 1 project + 1 category
      expect(dailyIncidentals?.length).toBe(1);

      // Check that project comes first
      expect('documentId' in dailySections![0]).toBe(true);
      expect((dailySections![0] as Project).documentId).toBe('project-1');

      // Check that category comes second
      expect((dailySections![1] as any).title).toBe('home chores');
    });

    it('should sort tasks alphabetically within each group', () => {
      const task1 = createTask({
        documentId: 'task-1',
        title: 'Zebra task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const task2 = createTask({
        documentId: 'task-2',
        title: 'Apple task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const task3 = createTask({
        documentId: 'task-3',
        title: 'Banana task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [
          {
            title: 'home chores',
            tasks: [task1, task2, task3],
          },
        ],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const dailySections = result.recurringReviewSections?.get('daily');
      const choresTasks = (dailySections![0] as any).tasks;

      expect(choresTasks[0].title).toBe('Apple task');
      expect(choresTasks[1].title).toBe('Banana task');
      expect(choresTasks[2].title).toBe('Zebra task');
    });
  });

  describe('recurrence type coverage', () => {
    const recurrenceTypes: Array<{ type: RecurrenceType; extraFields?: Partial<Task>; expectedKey?: RecurrenceType | "monthly" }> = [
      { type: 'daily' },
      { type: 'every x days', extraFields: { recurrenceInterval: 3 } },
      { type: 'weekly', extraFields: { recurrenceDayOfWeek: 1 } },
      { type: 'biweekly', extraFields: { recurrenceDayOfWeek: 1 } },
      { type: 'monthly date', extraFields: { recurrenceDayOfMonth: 15 }, expectedKey: 'monthly' },
      {
        type: 'monthly day',
        extraFields: { recurrenceWeekOfMonth: 2, recurrenceDayOfWeekMonthly: 1 },
        expectedKey: 'monthly',
      },
      { type: 'annually', extraFields: { recurrenceMonth: 3, recurrenceDayOfMonth: 15 } },
      { type: 'full moon' },
      { type: 'new moon' },
      { type: 'every season' },
      { type: 'winter solstice' },
      { type: 'spring equinox' },
      { type: 'summer solstice' },
      { type: 'autumn equinox' },
    ];

    recurrenceTypes.forEach(({ type, extraFields, expectedKey }) => {
      it(`should handle ${type} recurrence type`, () => {
        const task = createTask({
          documentId: 'task-1',
          title: `${type} task`,
          isRecurring: true,
          recurrenceType: type,
          completed: false,
          ...extraFields,
        });

        const rawData: RawTaskData = {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [task],
        };

        const result = transformLayout(rawData, recurringReviewRuleset);

        const keyToCheck = expectedKey || type;
        expect(result.recurringReviewIncidentals?.has(keyToCheck)).toBe(true);
        const incidentals = result.recurringReviewIncidentals?.get(keyToCheck);
        expect(incidentals?.length).toBeGreaterThanOrEqual(1);
        expect(incidentals?.some(t => t.documentId === 'task-1')).toBe(true);
      });
    });
  });

  describe('multiple tasks per recurrence type', () => {
    it('should handle multiple projects with the same recurrence type', () => {
      const project1 = createProject({
        documentId: 'project-1',
        title: 'Alpha Project',
      });

      const project2 = createProject({
        documentId: 'project-2',
        title: 'Beta Project',
      });

      const task1 = createTask({
        documentId: 'task-1',
        title: 'Task 1',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project1,
      });

      const task2 = createTask({
        documentId: 'task-2',
        title: 'Task 2',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project2,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [
          { ...project1, tasks: [task1] },
          { ...project2, tasks: [task2] },
        ],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const dailySections = result.recurringReviewSections?.get('daily');
      expect(dailySections?.length).toBe(2);

      // Check alphabetical order
      expect((dailySections![0] as Project).title).toBe('Alpha Project');
      expect((dailySections![1] as Project).title).toBe('Beta Project');
    });

    it('should handle multiple categories with the same recurrence type', () => {
      const task1 = createTask({
        documentId: 'task-1',
        title: 'Task 1',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
        completed: false,
        category: 'home chores',
      });

      const task2 = createTask({
        documentId: 'task-2',
        title: 'Task 2',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
        completed: false,
        category: 'studio chores',
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [
          { title: 'home chores', tasks: [task1] },
          { title: 'studio chores', tasks: [task2] },
        ],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const weeklySections = result.recurringReviewSections?.get('weekly');
      expect(weeklySections?.length).toBe(2);

      // Check alphabetical order
      expect((weeklySections![0] as any).title).toBe('home chores');
      expect((weeklySections![1] as any).title).toBe('studio chores');
    });
  });

  describe('edge cases', () => {
    it('should handle empty projects', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Empty Project',
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, tasks: [] }],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      expect(result.recurringReviewSections?.size).toBe(0);
    });

    it('should handle tasks from all sources (projects, categories, incidentals)', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const projectTask = createTask({
        documentId: 'task-1',
        title: 'Project task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project,
      });

      const categoryTask = createTask({
        documentId: 'task-2',
        title: 'Category task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const incidentalTask = createTask({
        documentId: 'task-3',
        title: 'Incidental task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, tasks: [projectTask] }],
        recurringCategoryGroups: [{ title: 'home chores', tasks: [categoryTask] }],
        recurringIncidentals: [incidentalTask],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      expect(result.recurringReviewSections?.get('daily')?.length).toBe(2); // project + category
      expect(result.recurringReviewIncidentals?.get('daily')?.length).toBe(1);
    });
  });

  describe('monthly merge behavior', () => {
    it('should merge monthly date and monthly day into single monthly section', () => {
      const monthlyDateTask = createTask({
        documentId: 'task-date',
        title: 'Monthly date task',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        completed: false,
      });

      const monthlyDayTask = createTask({
        documentId: 'task-day',
        title: 'Monthly day task',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
        completed: false,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [monthlyDateTask, monthlyDayTask],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      // Both should be under "monthly" key
      expect(result.recurringReviewIncidentals?.has('monthly')).toBe(true);
      expect(result.recurringReviewIncidentals?.has('monthly date')).toBe(false);
      expect(result.recurringReviewIncidentals?.has('monthly day')).toBe(false);

      const monthlyIncidentals = result.recurringReviewIncidentals?.get('monthly');
      expect(monthlyIncidentals?.length).toBe(2);
    });

    it('should order monthly date tasks before monthly day tasks', () => {
      const monthlyDateTask1 = createTask({
        documentId: 'task-date-1',
        title: 'Zebra monthly date',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        completed: false,
      });

      const monthlyDateTask2 = createTask({
        documentId: 'task-date-2',
        title: 'Apple monthly date',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 1,
        completed: false,
      });

      const monthlyDayTask1 = createTask({
        documentId: 'task-day-1',
        title: 'Zebra monthly day',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
        completed: false,
      });

      const monthlyDayTask2 = createTask({
        documentId: 'task-day-2',
        title: 'Apple monthly day',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 1,
        recurrenceDayOfWeekMonthly: 3,
        completed: false,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [monthlyDayTask1, monthlyDateTask1, monthlyDayTask2, monthlyDateTask2],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const monthlyIncidentals = result.recurringReviewIncidentals?.get('monthly');
      expect(monthlyIncidentals?.length).toBe(4);

      // First two should be monthly date (alphabetically sorted)
      expect(monthlyIncidentals?.[0].recurrenceType).toBe('monthly date');
      expect(monthlyIncidentals?.[0].title).toBe('Apple monthly date');
      expect(monthlyIncidentals?.[1].recurrenceType).toBe('monthly date');
      expect(monthlyIncidentals?.[1].title).toBe('Zebra monthly date');

      // Last two should be monthly day (alphabetically sorted)
      expect(monthlyIncidentals?.[2].recurrenceType).toBe('monthly day');
      expect(monthlyIncidentals?.[2].title).toBe('Apple monthly day');
      expect(monthlyIncidentals?.[3].recurrenceType).toBe('monthly day');
      expect(monthlyIncidentals?.[3].title).toBe('Zebra monthly day');
    });

    it('should maintain monthly merge within projects', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const monthlyDateTask = createTask({
        documentId: 'task-date',
        title: 'Zebra date',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        completed: false,
        project,
      });

      const monthlyDayTask = createTask({
        documentId: 'task-day',
        title: 'Apple day',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
        completed: false,
        project,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, tasks: [monthlyDayTask, monthlyDateTask] }],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const monthlySections = result.recurringReviewSections?.get('monthly');
      expect(monthlySections?.length).toBe(1);

      const projectSection = monthlySections?.[0] as Project;
      expect(projectSection.tasks?.length).toBe(2);

      // Monthly date should come first
      expect(projectSection.tasks?.[0].recurrenceType).toBe('monthly date');
      expect(projectSection.tasks?.[0].title).toBe('Zebra date');
      expect(projectSection.tasks?.[1].recurrenceType).toBe('monthly day');
      expect(projectSection.tasks?.[1].title).toBe('Apple day');
    });
  });

  describe('every x days sorting', () => {
    it('should sort every x days tasks by interval first, then alphabetically', () => {
      const task2Days = createTask({
        documentId: 'task-2',
        title: 'Zebra task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 2,
        completed: false,
      });

      const task7Days = createTask({
        documentId: 'task-7',
        title: 'Apple task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 7,
        completed: false,
      });

      const task2DaysB = createTask({
        documentId: 'task-2b',
        title: 'Apple task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 2,
        completed: false,
      });

      const task14Days = createTask({
        documentId: 'task-14',
        title: 'Beta task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 14,
        completed: false,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [task7Days, task2Days, task14Days, task2DaysB],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const everyXDaysIncidentals = result.recurringReviewIncidentals?.get('every x days');
      expect(everyXDaysIncidentals?.length).toBe(4);

      // Should be ordered: 2 days (Apple), 2 days (Zebra), 7 days (Apple), 14 days (Beta)
      expect(everyXDaysIncidentals?.[0].recurrenceInterval).toBe(2);
      expect(everyXDaysIncidentals?.[0].title).toBe('Apple task');
      expect(everyXDaysIncidentals?.[1].recurrenceInterval).toBe(2);
      expect(everyXDaysIncidentals?.[1].title).toBe('Zebra task');
      expect(everyXDaysIncidentals?.[2].recurrenceInterval).toBe(7);
      expect(everyXDaysIncidentals?.[2].title).toBe('Apple task');
      expect(everyXDaysIncidentals?.[3].recurrenceInterval).toBe(14);
      expect(everyXDaysIncidentals?.[3].title).toBe('Beta task');
    });

    it('should apply interval sorting within projects', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const task7Days = createTask({
        documentId: 'task-7',
        title: 'Seven days',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 7,
        completed: false,
        project,
      });

      const task2Days = createTask({
        documentId: 'task-2',
        title: 'Two days',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 2,
        completed: false,
        project,
      });

      const rawData: RawTaskData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, tasks: [task7Days, task2Days] }],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const everyXDaysSections = result.recurringReviewSections?.get('every x days');
      expect(everyXDaysSections?.length).toBe(1);

      const projectSection = everyXDaysSections?.[0] as Project;
      expect(projectSection.tasks?.length).toBe(2);

      // Should be ordered by interval: 2 days first, then 7 days
      expect(projectSection.tasks?.[0].recurrenceInterval).toBe(2);
      expect(projectSection.tasks?.[0].title).toBe('Two days');
      expect(projectSection.tasks?.[1].recurrenceInterval).toBe(7);
      expect(projectSection.tasks?.[1].title).toBe('Seven days');
    });
  });
});
