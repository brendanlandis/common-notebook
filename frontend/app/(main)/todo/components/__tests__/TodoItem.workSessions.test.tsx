import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TodoItem from '../TodoItem';
import type { Todo } from '@/app/types/index';

// Mock date utilities
vi.mock('@/app/lib/dateUtils', () => ({
  getNowInEST: vi.fn(() => new Date('2026-01-10T12:00:00.000Z')),
  parseInEST: (dateString: string) => new Date(dateString + 'T00:00:00'),
  formatInEST: (date: Date, format: string) => {
    if (format === 'h:mm a') {
      return '10:00 AM';
    }
    return 'Monday';
  },
  toISODateInEST: (date: Date) => date.toISOString().split('T')[0],
}));

// Helper to create minimal todo
function createTodo(overrides: Partial<Todo>): Todo {
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
    category: null,
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

describe('TodoItem - Work Session Features', () => {
  const mockHandlers = {
    onComplete: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onWorkSession: vi.fn(),
    onRemoveWorkSession: vi.fn(),
    onSkipRecurring: vi.fn(),
  };

  describe('Cookie Icon - Add Work Session', () => {
    it('should show cookie icon for long tasks', () => {
      const todo = createTodo({
        documentId: 'long-task-1',
        title: 'Long Project Task',
        long: true,
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const cookieButton = screen.getByRole('button', { name: /mark as worked on today/i });
      expect(cookieButton).toBeDefined();
      expect(cookieButton.title).toBe('mark as worked on today');
    });

    it('should not show cookie icon for non-long tasks', () => {
      const todo = createTodo({
        documentId: 'regular-task',
        title: 'Regular Task',
        long: false,
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const cookieButton = screen.queryByRole('button', { name: /mark as worked on today/i });
      expect(cookieButton).toBeNull();
    });

    it('should call onWorkSession when cookie icon is clicked', () => {
      const todo = createTodo({
        documentId: 'long-task-1',
        title: 'Long Task',
        long: true,
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const cookieButton = screen.getByRole('button', { name: /mark as worked on today/i });
      cookieButton.click();

      expect(mockHandlers.onWorkSession).toHaveBeenCalledWith('long-task-1');
    });

    it('should not show add cookie icon for worked-on virtual entries', () => {
      const todo = createTodo({
        documentId: 'long-task-1-worked-2026-01-09',
        title: 'Long Task',
        long: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const addButton = screen.queryByRole('button', { name: /mark as worked on today/i });
      expect(addButton).toBeNull();
    });
  });

  describe('Cookie Icon - Remove Work Session', () => {
    it('should show remove cookie icon for worked-on virtual entries', () => {
      const todo = createTodo({
        documentId: 'long-task-1-worked-2026-01-09',
        title: 'Long Task',
        long: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const removeButton = screen.getByRole('button', { name: /remove work session/i });
      expect(removeButton).toBeDefined();
      expect(removeButton.title).toBe('remove work session');
    });

    it('should call onRemoveWorkSession with correct parameters', () => {
      const todo = createTodo({
        documentId: 'long-task-1-worked-2026-01-09',
        title: 'Long Task',
        long: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const removeButton = screen.getByRole('button', { name: /remove work session/i });
      removeButton.click();

      expect(mockHandlers.onRemoveWorkSession).toHaveBeenCalledWith('long-task-1', '2026-01-09');
    });

    it('should not show remove cookie icon if onRemoveWorkSession is not provided', () => {
      const todo = createTodo({
        documentId: 'long-task-1-worked-2026-01-09',
        title: 'Long Task',
        long: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      const handlers = { ...mockHandlers, onRemoveWorkSession: undefined };
      render(<TodoItem {...handlers} todo={todo} />);

      const removeButton = screen.queryByRole('button', { name: /remove work session/i });
      expect(removeButton).toBeNull();
    });

    it('should parse complex documentId patterns correctly', () => {
      const todo = createTodo({
        documentId: 'abc-123-xyz-worked-2026-01-05',
        title: 'Task',
        long: true,
        completed: false,
        completedAt: '2026-01-05T14:30:00.000Z',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const removeButton = screen.getByRole('button', { name: /remove work session/i });
      removeButton.click();

      expect(mockHandlers.onRemoveWorkSession).toHaveBeenCalledWith('abc-123-xyz', '2026-01-05');
    });
  });

  describe('CSS Classes for Work Sessions', () => {
    it('should apply "worked-on" class for virtual entries', () => {
      const todo = createTodo({
        documentId: 'task-1-worked-2026-01-09',
        title: 'Task',
        long: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      const { container } = render(<TodoItem {...mockHandlers} todo={todo} />);

      const listItem = container.querySelector('li');
      expect(listItem).toBeDefined();
      expect(listItem!.className).toBe('worked-on');
    });

    it('should apply "completed" class for completed tasks', () => {
      const todo = createTodo({
        documentId: 'task-1',
        title: 'Completed Task',
        completed: true,
        completedAt: '2026-01-09T15:00:00.000Z',
      });

      const { container } = render(<TodoItem {...mockHandlers} todo={todo} />);

      const listItem = container.querySelector('li');
      expect(listItem).toBeDefined();
      expect(listItem!.className).toBe('completed');
    });

    it('should not apply any class for incomplete non-virtual tasks', () => {
      const todo = createTodo({
        documentId: 'task-1',
        title: 'Regular Task',
        completed: false,
      });

      const { container } = render(<TodoItem {...mockHandlers} todo={todo} />);

      const listItem = container.querySelector('li');
      expect(listItem).toBeDefined();
      expect(listItem!.className).toBe('');
    });

    it('should prioritize "worked-on" over "completed" for virtual entries', () => {
      const todo = createTodo({
        documentId: 'task-1-worked-2026-01-09',
        title: 'Task',
        long: true,
        completed: false, // Virtual entries always have completed=false
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      const { container } = render(<TodoItem {...mockHandlers} todo={todo} />);

      const listItem = container.querySelector('li');
      expect(listItem!.className).toBe('worked-on');
    });
  });

  describe('Virtual Entry Display', () => {
    it('should show "worked on" prefix for worked-on virtual entries', () => {
      const todo = createTodo({
        documentId: 'task-1-worked-2026-01-09',
        title: 'Long Task',
        long: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      // Should show "worked on" prefix
      expect(screen.getByText(/worked on/i)).toBeDefined();
      expect(screen.getByText(/Long Task/i)).toBeDefined();
    });

    it('should not show skip button for worked-on virtual entries', () => {
      const todo = createTodo({
        documentId: 'task-1-worked-2026-01-09',
        title: 'Recurring Task',
        long: true,
        isRecurring: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const skipButton = screen.queryByRole('button', { name: /skip this one/i });
      expect(skipButton).toBeNull();
    });
  });

  describe('Combined Scenarios', () => {
    it('should show add cookie icon and skip button for recurring long tasks', () => {
      const todo = createTodo({
        documentId: 'recurring-long',
        title: 'Recurring Long Task',
        long: true,
        isRecurring: true,
        recurrenceType: 'daily',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const cookieButton = screen.getByRole('button', { name: /mark as worked on today/i });
      const skipButton = screen.getByRole('button', { name: /skip this one/i });

      expect(cookieButton).toBeDefined();
      expect(skipButton).toBeDefined();
    });

    it('should handle completed long tasks with work sessions', () => {
      const todo = createTodo({
        documentId: 'long-completed',
        title: 'Completed Long Task',
        long: true,
        completed: true,
        completedAt: '2026-01-09T15:00:00.000Z',
        workSessions: [
          { date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
        ],
      });

      const { container } = render(<TodoItem {...mockHandlers} todo={todo} />);

      // Should have completed class
      const listItem = container.querySelector('li');
      expect(listItem!.className).toBe('completed');

      // Should still show add cookie icon (for adding more work sessions)
      const cookieButton = screen.getByRole('button', { name: /mark as worked on today/i });
      expect(cookieButton).toBeDefined();
    });
  });

  describe('DocumentId Pattern Matching', () => {
    it('should not treat tasks with "worked" in name as virtual entries', () => {
      const todo = createTodo({
        documentId: 'task-about-worked-hours',
        title: 'Task about worked hours',
        long: true,
      });

      const { container } = render(<TodoItem {...mockHandlers} todo={todo} />);

      // Should show add cookie icon (not remove)
      const addButton = screen.getByRole('button', { name: /mark as worked on today/i });
      expect(addButton).toBeDefined();

      // Should not have worked-on class
      const listItem = container.querySelector('li');
      expect(listItem!.className).toBe('');
    });

    it('should correctly identify virtual entries with date suffix', () => {
      const todo = createTodo({
        documentId: 'my-task-worked-2026-01-09',
        title: 'My Task',
        long: true,
        completed: false,
        completedAt: '2026-01-09T10:00:00.000Z',
      });

      const { container } = render(<TodoItem {...mockHandlers} todo={todo} />);

      // Should have worked-on class
      const listItem = container.querySelector('li');
      expect(listItem!.className).toBe('worked-on');

      // Should show remove cookie icon
      const removeButton = screen.getByRole('button', { name: /remove work session/i });
      expect(removeButton).toBeDefined();
    });

    it('should handle edge case with numbers in documentId', () => {
      const todo = createTodo({
        documentId: 'task-123-worked-2026-12-31',
        title: 'Task 123',
        long: true,
        completed: false,
        completedAt: '2026-12-31T23:59:00.000Z',
      });

      render(<TodoItem {...mockHandlers} todo={todo} />);

      const removeButton = screen.getByRole('button', { name: /remove work session/i });
      removeButton.click();

      expect(mockHandlers.onRemoveWorkSession).toHaveBeenCalledWith('task-123', '2026-12-31');
    });
  });
});
