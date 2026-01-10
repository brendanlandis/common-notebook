import { describe, it, expect, beforeEach } from 'vitest';
import { transformLayout } from '../layoutTransformers';
import type { RawTodoData } from '../layoutTransformers';
import type { LayoutRuleset, Todo, Project, RecurrenceType } from '@/app/types/index';

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
    todos: [],
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
    it('should return empty structure when there are no recurring todos', () => {
      const rawData: RawTodoData = {
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

    it('should group todos by recurrence type', () => {
      const dailyTodo = createTodo({
        documentId: 'todo-1',
        title: 'Daily task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const weeklyTodo = createTodo({
        documentId: 'todo-2',
        title: 'Weekly task',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
        completed: false,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [dailyTodo, weeklyTodo],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      // Incidentals only appear in recurringReviewIncidentals, not sections
      expect(result.recurringReviewIncidentals?.size).toBe(2);
      expect(result.recurringReviewIncidentals?.has('daily')).toBe(true);
      expect(result.recurringReviewIncidentals?.has('weekly')).toBe(true);
      expect(result.recurringReviewIncidentals?.get('daily')?.length).toBe(1);
      expect(result.recurringReviewIncidentals?.get('weekly')?.length).toBe(1);
    });

    it('should exclude completed recurring todos', () => {
      const incompleteTodo = createTodo({
        documentId: 'todo-1',
        title: 'Incomplete task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const completedTodo = createTodo({
        documentId: 'todo-2',
        title: 'Completed task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: true,
        completedAt: '2024-01-01T12:00:00Z',
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [incompleteTodo, completedTodo],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const dailyIncidentals = result.recurringReviewIncidentals?.get('daily');
      expect(dailyIncidentals?.length).toBe(1);
      expect(dailyIncidentals?.[0].documentId).toBe('todo-1');
    });
  });

  describe('organization within recurrence types', () => {
    it('should organize todos by project, then category, then incidentals', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const projectTodo = createTodo({
        documentId: 'todo-1',
        title: 'Project task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project,
      });

      const categoryTodo = createTodo({
        documentId: 'todo-2',
        title: 'Category task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const incidentalTodo = createTodo({
        documentId: 'todo-3',
        title: 'Incidental task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, todos: [projectTodo] }],
        recurringCategoryGroups: [
          {
            title: 'home chores',
            todos: [categoryTodo],
          },
        ],
        recurringIncidentals: [incidentalTodo],
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

    it('should sort todos alphabetically within each group', () => {
      const todo1 = createTodo({
        documentId: 'todo-1',
        title: 'Zebra task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const todo2 = createTodo({
        documentId: 'todo-2',
        title: 'Apple task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const todo3 = createTodo({
        documentId: 'todo-3',
        title: 'Banana task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [
          {
            title: 'home chores',
            todos: [todo1, todo2, todo3],
          },
        ],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const dailySections = result.recurringReviewSections?.get('daily');
      const choresTodos = (dailySections![0] as any).todos;

      expect(choresTodos[0].title).toBe('Apple task');
      expect(choresTodos[1].title).toBe('Banana task');
      expect(choresTodos[2].title).toBe('Zebra task');
    });
  });

  describe('recurrence type coverage', () => {
    const recurrenceTypes: Array<{ type: RecurrenceType; extraFields?: Partial<Todo>; expectedKey?: RecurrenceType | "monthly" }> = [
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
        const todo = createTodo({
          documentId: 'todo-1',
          title: `${type} task`,
          isRecurring: true,
          recurrenceType: type,
          completed: false,
          ...extraFields,
        });

        const rawData: RawTodoData = {
          projects: [],
          categoryGroups: [],
          incidentals: [],
          recurringProjects: [],
          recurringCategoryGroups: [],
          recurringIncidentals: [todo],
        };

        const result = transformLayout(rawData, recurringReviewRuleset);

        const keyToCheck = expectedKey || type;
        expect(result.recurringReviewIncidentals?.has(keyToCheck)).toBe(true);
        const incidentals = result.recurringReviewIncidentals?.get(keyToCheck);
        expect(incidentals?.length).toBeGreaterThanOrEqual(1);
        expect(incidentals?.some(t => t.documentId === 'todo-1')).toBe(true);
      });
    });
  });

  describe('multiple todos per recurrence type', () => {
    it('should handle multiple projects with the same recurrence type', () => {
      const project1 = createProject({
        documentId: 'project-1',
        title: 'Alpha Project',
      });

      const project2 = createProject({
        documentId: 'project-2',
        title: 'Beta Project',
      });

      const todo1 = createTodo({
        documentId: 'todo-1',
        title: 'Task 1',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project1,
      });

      const todo2 = createTodo({
        documentId: 'todo-2',
        title: 'Task 2',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project2,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [
          { ...project1, todos: [todo1] },
          { ...project2, todos: [todo2] },
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
      const todo1 = createTodo({
        documentId: 'todo-1',
        title: 'Task 1',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
        completed: false,
        category: 'home chores',
      });

      const todo2 = createTodo({
        documentId: 'todo-2',
        title: 'Task 2',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
        completed: false,
        category: 'studio chores',
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [
          { title: 'home chores', todos: [todo1] },
          { title: 'studio chores', todos: [todo2] },
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

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, todos: [] }],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      expect(result.recurringReviewSections?.size).toBe(0);
    });

    it('should handle todos from all sources (projects, categories, incidentals)', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const projectTodo = createTodo({
        documentId: 'todo-1',
        title: 'Project task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        project: project,
      });

      const categoryTodo = createTodo({
        documentId: 'todo-2',
        title: 'Category task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
        category: 'home chores',
      });

      const incidentalTodo = createTodo({
        documentId: 'todo-3',
        title: 'Incidental task',
        isRecurring: true,
        recurrenceType: 'daily',
        completed: false,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, todos: [projectTodo] }],
        recurringCategoryGroups: [{ title: 'home chores', todos: [categoryTodo] }],
        recurringIncidentals: [incidentalTodo],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      expect(result.recurringReviewSections?.get('daily')?.length).toBe(2); // project + category
      expect(result.recurringReviewIncidentals?.get('daily')?.length).toBe(1);
    });
  });

  describe('monthly merge behavior', () => {
    it('should merge monthly date and monthly day into single monthly section', () => {
      const monthlyDateTodo = createTodo({
        documentId: 'todo-date',
        title: 'Monthly date task',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        completed: false,
      });

      const monthlyDayTodo = createTodo({
        documentId: 'todo-day',
        title: 'Monthly day task',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
        completed: false,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [monthlyDateTodo, monthlyDayTodo],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      // Both should be under "monthly" key
      expect(result.recurringReviewIncidentals?.has('monthly')).toBe(true);
      expect(result.recurringReviewIncidentals?.has('monthly date')).toBe(false);
      expect(result.recurringReviewIncidentals?.has('monthly day')).toBe(false);

      const monthlyIncidentals = result.recurringReviewIncidentals?.get('monthly');
      expect(monthlyIncidentals?.length).toBe(2);
    });

    it('should order monthly date todos before monthly day todos', () => {
      const monthlyDateTodo1 = createTodo({
        documentId: 'todo-date-1',
        title: 'Zebra monthly date',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        completed: false,
      });

      const monthlyDateTodo2 = createTodo({
        documentId: 'todo-date-2',
        title: 'Apple monthly date',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 1,
        completed: false,
      });

      const monthlyDayTodo1 = createTodo({
        documentId: 'todo-day-1',
        title: 'Zebra monthly day',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
        completed: false,
      });

      const monthlyDayTodo2 = createTodo({
        documentId: 'todo-day-2',
        title: 'Apple monthly day',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 1,
        recurrenceDayOfWeekMonthly: 3,
        completed: false,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [monthlyDayTodo1, monthlyDateTodo1, monthlyDayTodo2, monthlyDateTodo2],
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

      const monthlyDateTodo = createTodo({
        documentId: 'todo-date',
        title: 'Zebra date',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        completed: false,
        project,
      });

      const monthlyDayTodo = createTodo({
        documentId: 'todo-day',
        title: 'Apple day',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
        completed: false,
        project,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, todos: [monthlyDayTodo, monthlyDateTodo] }],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const monthlySections = result.recurringReviewSections?.get('monthly');
      expect(monthlySections?.length).toBe(1);

      const projectSection = monthlySections?.[0] as Project;
      expect(projectSection.todos?.length).toBe(2);

      // Monthly date should come first
      expect(projectSection.todos?.[0].recurrenceType).toBe('monthly date');
      expect(projectSection.todos?.[0].title).toBe('Zebra date');
      expect(projectSection.todos?.[1].recurrenceType).toBe('monthly day');
      expect(projectSection.todos?.[1].title).toBe('Apple day');
    });
  });

  describe('every x days sorting', () => {
    it('should sort every x days todos by interval first, then alphabetically', () => {
      const todo2Days = createTodo({
        documentId: 'todo-2',
        title: 'Zebra task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 2,
        completed: false,
      });

      const todo7Days = createTodo({
        documentId: 'todo-7',
        title: 'Apple task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 7,
        completed: false,
      });

      const todo2DaysB = createTodo({
        documentId: 'todo-2b',
        title: 'Apple task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 2,
        completed: false,
      });

      const todo14Days = createTodo({
        documentId: 'todo-14',
        title: 'Beta task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 14,
        completed: false,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [],
        recurringCategoryGroups: [],
        recurringIncidentals: [todo7Days, todo2Days, todo14Days, todo2DaysB],
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

      const todo7Days = createTodo({
        documentId: 'todo-7',
        title: 'Seven days',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 7,
        completed: false,
        project,
      });

      const todo2Days = createTodo({
        documentId: 'todo-2',
        title: 'Two days',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 2,
        completed: false,
        project,
      });

      const rawData: RawTodoData = {
        projects: [],
        categoryGroups: [],
        incidentals: [],
        recurringProjects: [{ ...project, todos: [todo7Days, todo2Days] }],
        recurringCategoryGroups: [],
        recurringIncidentals: [],
      };

      const result = transformLayout(rawData, recurringReviewRuleset);

      const everyXDaysSections = result.recurringReviewSections?.get('every x days');
      expect(everyXDaysSections?.length).toBe(1);

      const projectSection = everyXDaysSections?.[0] as Project;
      expect(projectSection.todos?.length).toBe(2);

      // Should be ordered by interval: 2 days first, then 7 days
      expect(projectSection.todos?.[0].recurrenceInterval).toBe(2);
      expect(projectSection.todos?.[0].title).toBe('Two days');
      expect(projectSection.todos?.[1].recurrenceInterval).toBe(7);
      expect(projectSection.todos?.[1].title).toBe('Seven days');
    });
  });
});
