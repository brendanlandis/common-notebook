import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('Completed Task Visibility Integration Tests', () => {
  let completedTaskVisibilityConfig: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_COMPLETED_TASK_VISIBILITY_MINUTES;
    
    // Reimport to reset cache
    completedTaskVisibilityConfig = await import('./completedTaskVisibilityConfig');
  });

  describe('Todo Page Initial Load Scenario', () => {
    it('should filter completed tasks correctly when using default value (bug scenario)', async () => {
      // Simulate: Page loads, cache is null, so it uses default (15 mins)
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      expect(visibilityMinutes).toBe(15); // Default value
      
      // Simulate: A task completed 194 minutes ago (from the actual bug report)
      const now = new Date('2026-01-08T17:14:03.795Z');
      const completedAt = new Date('2026-01-08T13:59:27.696Z');
      const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);
      
      expect(minutesSinceCompletion).toBeGreaterThan(194);
      expect(minutesSinceCompletion).toBeLessThan(195);
      
      // With default 15 minutes, task should be filtered out
      const shouldBeVisible = minutesSinceCompletion <= visibilityMinutes;
      expect(shouldBeVisible).toBe(false); // BUG: Task hidden incorrectly
    });

    it('should filter completed tasks correctly after fetching settings (fix scenario)', async () => {
      // Mock API response with actual setting (1440 mins = 24 hours)
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Simulate THE FIX: Fetch settings before filtering
      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      expect(visibilityMinutes).toBe(1440); // Correct value
      
      // Same task completed 194 minutes ago
      const now = new Date('2026-01-08T17:14:03.795Z');
      const completedAt = new Date('2026-01-08T13:59:27.696Z');
      const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);
      
      // With correct 1440 minutes, task should be visible
      const shouldBeVisible = minutesSinceCompletion <= visibilityMinutes;
      expect(shouldBeVisible).toBe(true); // FIXED: Task visible correctly
    });

    it('should demonstrate the complete bug scenario and fix', async () => {
      // BEFORE FIX: Initial page load without fetching settings
      const beforeVisibility = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      const completedTask = {
        id: 15,
        title: 'test one',
        completed: true,
        completedAt: '2026-01-08T13:59:27.696Z',
      };
      
      const now = new Date('2026-01-08T17:14:03.795Z');
      const completedTime = new Date(completedTask.completedAt);
      const minutesSinceCompletion = (now.getTime() - completedTime.getTime()) / (1000 * 60);
      
      // Before fix: filtered out incorrectly
      const visibleBeforeFix = minutesSinceCompletion <= beforeVisibility;
      expect(visibleBeforeFix).toBe(false);
      
      // AFTER FIX: Fetch settings first (simulating the useEffect change)
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      const afterVisibility = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      // After fix: visible correctly
      const visibleAfterFix = minutesSinceCompletion <= afterVisibility;
      expect(visibleAfterFix).toBe(true);
    });
  });

  describe('Settings Page Navigation Scenario', () => {
    it('should simulate the workaround: visiting settings populates cache', async () => {
      // Initial state: cache is null
      let visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(visibilityMinutes).toBe(15); // Default
      
      // User navigates to settings page
      // Settings page calls fetchVisibilityMinutesFromStrapi
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      // Now cache is populated
      visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(visibilityMinutes).toBe(1440);
      
      // User navigates back to todo page
      // Now it uses the cached value (the workaround that made it work)
      visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(visibilityMinutes).toBe(1440);
    });
  });

  describe('Edge Cases in Task Filtering', () => {
    it('should handle task completed exactly at visibility boundary', async () => {
      const mockResponse = {
        success: true,
        value: '60', // 1 hour
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      // Task completed exactly 60 minutes ago
      const now = new Date('2026-01-08T17:00:00.000Z');
      const completedAt = new Date('2026-01-08T16:00:00.000Z');
      const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);
      
      expect(minutesSinceCompletion).toBe(60);
      
      // At boundary, should still be visible (<=)
      const shouldBeVisible = minutesSinceCompletion <= visibilityMinutes;
      expect(shouldBeVisible).toBe(true);
    });

    it('should handle task completed just over visibility boundary', async () => {
      const mockResponse = {
        success: true,
        value: '60',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      // Task completed 61 minutes ago (just over boundary)
      const now = new Date('2026-01-08T17:00:00.000Z');
      const completedAt = new Date('2026-01-08T15:59:00.000Z');
      const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);
      
      expect(minutesSinceCompletion).toBe(61);
      
      // Over boundary, should be hidden
      const shouldBeVisible = minutesSinceCompletion <= visibilityMinutes;
      expect(shouldBeVisible).toBe(false);
    });

    it('should handle task completed just completed (0 minutes)', async () => {
      const mockResponse = {
        success: true,
        value: '15',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      // Task just completed
      const now = new Date('2026-01-08T17:00:00.000Z');
      const completedAt = new Date('2026-01-08T17:00:00.000Z');
      const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);
      
      expect(minutesSinceCompletion).toBe(0);
      
      // Just completed, should be visible
      const shouldBeVisible = minutesSinceCompletion <= visibilityMinutes;
      expect(shouldBeVisible).toBe(true);
    });

    it('should handle zero visibility setting (tasks disappear immediately)', async () => {
      const mockResponse = {
        success: true,
        value: '0', // Tasks should disappear right away
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      expect(visibilityMinutes).toBe(0);
      
      // Task completed 1 minute ago
      const now = new Date('2026-01-08T17:00:00.000Z');
      const completedAt = new Date('2026-01-08T16:59:00.000Z');
      const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);
      
      expect(minutesSinceCompletion).toBe(1);
      
      // With 0 visibility, task should be hidden
      const shouldBeVisible = minutesSinceCompletion <= visibilityMinutes;
      expect(shouldBeVisible).toBe(false);
    });

    it('should handle large visibility setting (24 hours)', async () => {
      const mockResponse = {
        success: true,
        value: '1440', // 24 hours
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      expect(visibilityMinutes).toBe(1440);
      
      // Task completed 23 hours ago
      const now = new Date('2026-01-08T17:00:00.000Z');
      const completedAt = new Date('2026-01-07T18:00:00.000Z');
      const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);
      
      expect(minutesSinceCompletion).toBe(1380); // 23 hours
      
      // Within 24 hours, should be visible
      const shouldBeVisible = minutesSinceCompletion <= visibilityMinutes;
      expect(shouldBeVisible).toBe(true);
    });
  });

  describe('Multiple Todo Filtering Scenario', () => {
    it('should correctly filter mixed array of todos', async () => {
      const mockResponse = {
        success: true,
        value: '60', // 1 hour
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      const visibilityMinutes = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      const now = new Date('2026-01-08T17:00:00.000Z');
      
      const todos = [
        {
          id: 1,
          title: 'Incomplete task',
          completed: false,
          completedAt: null,
        },
        {
          id: 2,
          title: 'Just completed',
          completed: true,
          completedAt: '2026-01-08T16:55:00.000Z', // 5 mins ago
        },
        {
          id: 3,
          title: 'Completed at boundary',
          completed: true,
          completedAt: '2026-01-08T16:00:00.000Z', // Exactly 60 mins ago
        },
        {
          id: 4,
          title: 'Completed over boundary',
          completed: true,
          completedAt: '2026-01-08T15:59:00.000Z', // 61 mins ago
        },
        {
          id: 5,
          title: 'Completed way over boundary',
          completed: true,
          completedAt: '2026-01-08T13:00:00.000Z', // 4 hours ago
        },
      ];
      
      const visibleTodos = todos.filter(todo => {
        // Incomplete tasks are always visible
        if (!todo.completed || !todo.completedAt) {
          return true;
        }
        
        // Check if completed task is within visibility window
        const completedTime = new Date(todo.completedAt);
        const minutesSinceCompletion = (now.getTime() - completedTime.getTime()) / (1000 * 60);
        
        return minutesSinceCompletion <= visibilityMinutes;
      });
      
      // Should have: incomplete (1), just completed (2), at boundary (3)
      // Should NOT have: over boundary (4, 5)
      expect(visibleTodos).toHaveLength(3);
      expect(visibleTodos.map(t => t.id)).toEqual([1, 2, 3]);
    });
  });

  describe('Performance: Cache Efficiency', () => {
    it('should not make multiple API calls when cache is populated', async () => {
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // First call populates cache
      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      // Subsequent calls to get should not trigger API calls
      completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      // Fetch should have been called only once
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
