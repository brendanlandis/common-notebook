import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecurringReviewLayout from './RecurringReviewLayout';
import type { TransformedLayout } from '@/app/lib/layoutTransformers';
import type { LayoutRendererProps } from './types';
import type { Task, Project, RecurrenceType } from '@/app/types/index';

// Mock TaskItemRecurringReview component
vi.mock('../TaskItemRecurringReview', () => ({
  default: ({ task }: any) => (
    <li data-testid="task-item-recurring-review" data-task-id={task.documentId}>
      {task.title}
    </li>
  ),
}));

// Helper to create minimal task
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
    project: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    publishedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Helper to create minimal project
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

describe('RecurringReviewLayout', () => {
  const mockProps = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onEditProject: vi.fn(),
    selectedRulesetId: 'recurring',
    // These are still in LayoutRendererProps but not used by RecurringReviewLayout
    onComplete: vi.fn(),
    onWorkSession: vi.fn(),
    onRemoveWorkSession: vi.fn(),
    onSkipRecurring: vi.fn(),
  };

  describe('empty states', () => {
    it('should display "no recurring tasks" when there are no tasks', () => {
      const transformedData: TransformedLayout = {
        recurringReviewSections: new Map(),
        recurringReviewIncidentals: new Map(),
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('no recurring tasks')).toBeDefined();
    });

    it('should display "no recurring tasks" when sections map is undefined', () => {
      const transformedData: TransformedLayout = {};

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('no recurring tasks')).toBeDefined();
    });
  });

  describe('recurrence type labels', () => {
    it('should display "every day" for daily recurrence', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Daily task',
        isRecurring: true,
        recurrenceType: 'daily',
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('daily', []);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('daily', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('every day')).toBeDefined();
    });

    it('should display "every X days" with interval for every x days recurrence', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Every 3 days task',
        isRecurring: true,
        recurrenceType: 'every x days',
        recurrenceInterval: 3,
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('every x days', []);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('every x days', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('every x days')).toBeDefined();
    });

    it('should display "weekly" for weekly recurrence', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Weekly task',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('weekly', []);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('weekly', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('weekly')).toBeDefined();
    });

    it('should display "monthly" for monthly recurrence', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Monthly task',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
      });

      const sections = new Map<RecurrenceType | "monthly", any[]>();
      sections.set('monthly', []);

      const incidentals = new Map<RecurrenceType | "monthly", Task[]>();
      incidentals.set('monthly', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('monthly')).toBeDefined();
    });

    it('should display "full moon" for full moon recurrence', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Full moon task',
        isRecurring: true,
        recurrenceType: 'full moon',
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('full moon', []);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('full moon', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('full moon')).toBeDefined();
    });
  });

  describe('rendering sections and incidentals', () => {
    it('should render sections when they exist', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const task = createTask({
        documentId: 'task-1',
        title: 'Project task',
        isRecurring: true,
        recurrenceType: 'daily',
        project: project,
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('daily', [{ ...project, tasks: [task] }]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: new Map(),
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('every day')).toBeDefined();
      expect(screen.getByText('Test Project')).toBeDefined();
      expect(screen.getByText('Project task')).toBeDefined();
    });

    it('should render incidentals when they exist', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Incidental task',
        isRecurring: true,
        recurrenceType: 'daily',
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('daily', []);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('daily', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('every day')).toBeDefined();
      expect(screen.getByText('incidentals')).toBeDefined();
      expect(screen.getByText('Incidental task')).toBeDefined();
    });

    it('should render both sections and incidentals when both exist', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const projectTask = createTask({
        documentId: 'task-1',
        title: 'Project task',
        isRecurring: true,
        recurrenceType: 'daily',
        project: project,
      });

      const incidentalTask = createTask({
        documentId: 'task-2',
        title: 'Incidental task',
        isRecurring: true,
        recurrenceType: 'daily',
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('daily', [{ ...project, tasks: [projectTask] }]);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('daily', [incidentalTask]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('every day')).toBeDefined();
      expect(screen.getByText('Test Project')).toBeDefined();
      expect(screen.getByText('Project task')).toBeDefined();
      expect(screen.getByText('incidentals')).toBeDefined();
      expect(screen.getByText('Incidental task')).toBeDefined();
    });
  });

  describe('multiple recurrence types', () => {
    it('should render multiple recurrence type sections', () => {
      const dailyTask = createTask({
        documentId: 'task-1',
        title: 'Daily task',
        isRecurring: true,
        recurrenceType: 'daily',
      });

      const weeklyTask = createTask({
        documentId: 'task-2',
        title: 'Weekly task',
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1,
      });

      const monthlyTask = createTask({
        documentId: 'task-3',
        title: 'Monthly task',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
      });

      const sections = new Map<RecurrenceType | "monthly", any[]>();
      sections.set('daily', []);
      sections.set('weekly', []);
      sections.set('monthly', []);

      const incidentals = new Map<RecurrenceType | "monthly", Task[]>();
      incidentals.set('daily', [dailyTask]);
      incidentals.set('weekly', [weeklyTask]);
      incidentals.set('monthly', [monthlyTask]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('every day')).toBeDefined();
      expect(screen.getByText('weekly')).toBeDefined();
      expect(screen.getByText('monthly')).toBeDefined();
    });

    it('should not render sections for recurrence types with no tasks', () => {
      const dailyTask = createTask({
        documentId: 'task-1',
        title: 'Daily task',
        isRecurring: true,
        recurrenceType: 'daily',
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('daily', []);
      // Weekly is not in the map, so it should not render

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('daily', [dailyTask]);
      // Weekly is not in the map, so it should not render

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      expect(screen.getByText('every day')).toBeDefined();
      expect(screen.queryByText('weekly')).toBeNull();
    });
  });

  describe('CSS structure', () => {
    it('should wrap content in tasks-container', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Daily task',
        isRecurring: true,
        recurrenceType: 'daily',
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('daily', []);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('daily', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      const { container } = render(<RecurringReviewLayout {...props} />);

      const tasksContainer = container.querySelector('.tasks-container');
      expect(tasksContainer).toBeDefined();
    });

    it('should use task-section class for each recurrence type', () => {
      const task = createTask({
        documentId: 'task-1',
        title: 'Daily task',
        isRecurring: true,
        recurrenceType: 'daily',
      });

      const sections = new Map<RecurrenceType, any[]>();
      sections.set('daily', []);

      const incidentals = new Map<RecurrenceType, Task[]>();
      incidentals.set('daily', [task]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      const { container } = render(<RecurringReviewLayout {...props} />);

      const taskSection = container.querySelector('.task-section');
      expect(taskSection).toBeDefined();
    });
  });

  describe('monthly merge rendering', () => {
    it('should render monthly section with both monthly date and monthly day tasks', () => {
      const monthlyDateTask = createTask({
        documentId: 'task-date',
        title: 'Monthly date task',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
      });

      const monthlyDayTask = createTask({
        documentId: 'task-day',
        title: 'Monthly day task',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
      });

      const sections = new Map<RecurrenceType | "monthly", any[]>();
      sections.set('monthly', []);

      const incidentals = new Map<RecurrenceType | "monthly", Task[]>();
      incidentals.set('monthly', [monthlyDateTask, monthlyDayTask]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
        recurringReviewIncidentals: incidentals,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      // Should have one "monthly" section header
      expect(screen.getByText('monthly')).toBeDefined();

      // Should render both tasks
      const taskItems = screen.getAllByTestId('task-item-recurring-review');
      expect(taskItems).toHaveLength(2);
    });

    it('should render monthly section with projects containing mixed monthly types', () => {
      const project = createProject({
        documentId: 'project-1',
        title: 'Test Project',
      });

      const monthlyDateTask = createTask({
        documentId: 'task-date',
        title: 'Monthly date task',
        isRecurring: true,
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15,
        project,
      });

      const monthlyDayTask = createTask({
        documentId: 'task-day',
        title: 'Monthly day task',
        isRecurring: true,
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 1,
        project,
      });

      const projectWithTasks = {
        ...project,
        tasks: [monthlyDateTask, monthlyDayTask],
      };

      const sections = new Map<RecurrenceType | "monthly", any[]>();
      sections.set('monthly', [projectWithTasks]);

      const transformedData: TransformedLayout = {
        recurringReviewSections: sections,
      };

      const props: LayoutRendererProps = {
        ...mockProps,
        transformedData,
      };

      render(<RecurringReviewLayout {...props} />);

      // Should have one "monthly" section header
      expect(screen.getByText('monthly')).toBeDefined();

      // Should have project name as h4
      expect(screen.getByText('Test Project')).toBeDefined();

      // Should render both tasks
      const taskItems = screen.getAllByTestId('task-item-recurring-review');
      expect(taskItems).toHaveLength(2);
    });
  });
});
