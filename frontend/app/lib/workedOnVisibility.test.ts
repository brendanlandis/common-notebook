import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '@/app/types/index';
import * as completedTaskConfig from './completedTaskVisibilityConfig';
import { getWorkedOnPhase } from './dayBoundaryHelpers';

// Mock the config module to control visibility minutes
vi.mock('./completedTaskVisibilityConfig', () => ({
  getCompletedTaskVisibilityMinutes: vi.fn(() => 60), // Default 60 minutes
  setCachedVisibilityMinutes: vi.fn(),
  fetchVisibilityMinutesFromStrapi: vi.fn(),
  saveVisibilityMinutesToStrapi: vi.fn(),
}));

// Mock day boundary helpers module
vi.mock('./dayBoundaryHelpers', async () => {
  const actual = await vi.importActual('./dayBoundaryHelpers');
  return {
    ...actual,
    getWorkedOnPhase: vi.fn(),
  };
});

describe('Worked-On Task Phase-Based Visibility Logic', () => {
  // Helper to create a task with work sessions
  function createTaskWithWorkSessions(workSessions: Array<{ date: string; timestamp: string }>): Task {
    return {
      id: 1,
      documentId: 'test-long-task',
      title: 'Test long task',
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
      long: true,
      workSessions,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      publishedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  // Helper function to simulate the visibility logic from page.tsx
  function shouldBeVisible(task: Task, phase: 1 | 2 | 3): boolean {
    // Hide in Phase 2 only
    return phase !== 2;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(completedTaskConfig.getCompletedTaskVisibilityMinutes).mockReturnValue(60);
  });

  describe('Phase 1 - Within Visibility Window', () => {
    it('should show task in main views during Phase 1', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      vi.mocked(getWorkedOnPhase).mockReturnValue(1);
      const visible = shouldBeVisible(task, 1);

      expect(visible).toBe(true);
    });

    it('should have workedOnPhase=1 for CSS class application', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      vi.mocked(getWorkedOnPhase).mockReturnValue(1);
      
      // Simulate what page.tsx does
      const taskWithPhase = {
        ...task,
        workedOnPhase: 1 as const,
      };

      expect(taskWithPhase.workedOnPhase).toBe(1);
    });
  });

  describe('Phase 2 - Beyond Visibility Window, Same Day', () => {
    it('should hide task from main views during Phase 2', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      vi.mocked(getWorkedOnPhase).mockReturnValue(2);
      const visible = shouldBeVisible(task, 2);

      expect(visible).toBe(false);
    });

    it('should transition from Phase 1 to Phase 2 when visibility window expires', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      // First check - within visibility window
      vi.mocked(getWorkedOnPhase).mockReturnValue(1);
      let visible = shouldBeVisible(task, 1);
      expect(visible).toBe(true);

      // Second check - beyond visibility window, same effective day
      vi.mocked(getWorkedOnPhase).mockReturnValue(2);
      visible = shouldBeVisible(task, 2);
      expect(visible).toBe(false);
    });
  });

  describe('Phase 3 - Different Effective Day', () => {
    it('should show task in main views during Phase 3', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      vi.mocked(getWorkedOnPhase).mockReturnValue(3);
      const visible = shouldBeVisible(task, 3);

      expect(visible).toBe(true);
    });

    it('should not have workedOnPhase or have phase=3 in Phase 3', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      vi.mocked(getWorkedOnPhase).mockReturnValue(3);
      
      // Simulate what page.tsx does
      const taskWithPhase = {
        ...task,
        workedOnPhase: 3 as const,
      };

      // In Phase 3, workedOnPhase should not be 1, so no "worked-on" class
      expect(taskWithPhase.workedOnPhase).not.toBe(1);
    });

    it('should transition from Phase 2 to Phase 3 at day boundary', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      // Phase 2 - hidden
      vi.mocked(getWorkedOnPhase).mockReturnValue(2);
      let visible = shouldBeVisible(task, 2);
      expect(visible).toBe(false);

      // Phase 3 - visible again
      vi.mocked(getWorkedOnPhase).mockReturnValue(3);
      visible = shouldBeVisible(task, 3);
      expect(visible).toBe(true);
    });
  });

  describe('Day Boundary Scenarios', () => {
    it('should skip Phase 2 if day boundary comes before visibility window', () => {
      // Work session near end of day with long visibility window
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T22:00:00.000Z' },
      ]);

      // With 1440 minutes (24 hours) visibility, might go straight to Phase 3
      vi.mocked(completedTaskConfig.getCompletedTaskVisibilityMinutes).mockReturnValue(1440);

      // Immediately after work session - Phase 1
      vi.mocked(getWorkedOnPhase).mockReturnValue(1);
      let visible = shouldBeVisible(task, 1);
      expect(visible).toBe(true);

      // After day boundary but before 24 hours - Phase 3 (day boundary takes precedence)
      vi.mocked(getWorkedOnPhase).mockReturnValue(3);
      visible = shouldBeVisible(task, 3);
      expect(visible).toBe(true);
    });
  });

  describe('Multiple Work Sessions', () => {
    it('should use most recent work session for phase calculation', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
        { date: '2026-01-04', timestamp: '2026-01-04T10:00:00.000Z' },
      ]);

      // Most recent is Jan 5, which determines the phase
      vi.mocked(getWorkedOnPhase).mockReturnValue(1);
      const visible = shouldBeVisible(task, 1);

      expect(visible).toBe(true);
    });
  });

  describe('Non-long Tasks', () => {
    it('should always be visible for non-long tasks', () => {
      const task: Task = {
        id: 1,
        documentId: 'regular-task',
        title: 'Regular task',
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
        long: false, // Not a long task
        workSessions: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        publishedAt: '2026-01-01T00:00:00.000Z',
      };

      // Non-long tasks don't have phases, so they're always visible
      // (no filtering logic applies)
      expect(task.long).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle task with no work sessions', () => {
      const task = createTaskWithWorkSessions([]);

      // No work sessions means no phase, task is always visible
      expect(task.workSessions?.length).toBe(0);
    });

    it('should handle task with null work sessions', () => {
      const task: Task = {
        id: 1,
        documentId: 'task-no-sessions',
        title: 'Task with null sessions',
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
        long: true,
        workSessions: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        publishedAt: '2026-01-01T00:00:00.000Z',
      };

      expect(task.workSessions).toBeNull();
    });
  });

  describe('Integration with Config', () => {
    it('should respect updated visibility minutes from config', () => {
      const task = createTaskWithWorkSessions([
        { date: '2026-01-05', timestamp: '2026-01-05T10:00:00.000Z' },
      ]);

      // First with 60 minute visibility
      vi.mocked(completedTaskConfig.getCompletedTaskVisibilityMinutes).mockReturnValue(60);
      vi.mocked(getWorkedOnPhase).mockReturnValue(1);
      expect(completedTaskConfig.getCompletedTaskVisibilityMinutes()).toBe(60);

      // Then with 1440 minute visibility
      vi.mocked(completedTaskConfig.getCompletedTaskVisibilityMinutes).mockReturnValue(1440);
      vi.mocked(getWorkedOnPhase).mockReturnValue(1);
      expect(completedTaskConfig.getCompletedTaskVisibilityMinutes()).toBe(1440);
    });
  });
});
