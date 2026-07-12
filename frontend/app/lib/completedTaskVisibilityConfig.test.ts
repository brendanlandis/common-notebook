import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to reset the module state between tests
// Since the cache is a module-level variable, we'll need to reimport the module
let completedTaskVisibilityConfig: any;

// Mock fetch globally
global.fetch = vi.fn();

describe('Completed Task Visibility Configuration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Reset environment variables
    delete process.env.NEXT_PUBLIC_COMPLETED_TASK_VISIBILITY_MINUTES;
    
    // Reimport the module to reset the cache
    completedTaskVisibilityConfig = await import('./completedTaskVisibilityConfig');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCompletedTaskVisibilityMinutes', () => {
    it('should return default value (15) when cache is null and no env var set', async () => {
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(15);
    });

    it('should return env value when cache is null and env var is set', async () => {
      process.env.NEXT_PUBLIC_COMPLETED_TASK_VISIBILITY_MINUTES = '30';
      
      // Need to reimport after setting env var
      vi.resetModules();
      completedTaskVisibilityConfig = await import('./completedTaskVisibilityConfig');
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(30);
    });

    it('should return cached value when cache is populated', async () => {
      // Set cache first
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(60);
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(60);
    });

    it('should prioritize cached value over env var', async () => {
      process.env.NEXT_PUBLIC_COMPLETED_TASK_VISIBILITY_MINUTES = '30';
      
      // Need to reimport after setting env var
      vi.resetModules();
      completedTaskVisibilityConfig = await import('./completedTaskVisibilityConfig');
      
      // Set cache
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(120);
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(120); // Should use cache, not env
    });

    it('should ignore invalid env var and return default', async () => {
      process.env.NEXT_PUBLIC_COMPLETED_TASK_VISIBILITY_MINUTES = 'invalid';
      
      vi.resetModules();
      completedTaskVisibilityConfig = await import('./completedTaskVisibilityConfig');
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(15); // Should fall back to default
    });

    it('should ignore negative env var and return default', async () => {
      process.env.NEXT_PUBLIC_COMPLETED_TASK_VISIBILITY_MINUTES = '-10';
      
      vi.resetModules();
      completedTaskVisibilityConfig = await import('./completedTaskVisibilityConfig');
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(15); // Should fall back to default
    });
  });

  describe('setCachedVisibilityMinutes', () => {
    it('should set cache with valid positive value', async () => {
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(1440);
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(1440);
    });

    it('should set cache with zero value', async () => {
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(0);
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(0);
    });

    it('should not set cache with negative value', async () => {
      // First set a valid value
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(60);
      
      // Try to set negative value
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(-10);
      
      // Should still have the previous valid value
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(result).toBe(60);
    });
  });

  describe('fetchVisibilityMinutesFromStrapi', () => {
    it('should fetch from API and populate cache with valid response', async () => {
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      expect(result).toBe(1440);
      expect(fetch).toHaveBeenCalledWith('/api/system-settings?title=completedTaskVisibilityMinutes');
      
      // Verify cache was populated
      const cachedValue = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(cachedValue).toBe(1440);
    });

    it('should return null on failed API response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      expect(result).toBeNull();
    });

    it('should return null when API returns no value', async () => {
      const mockResponse = {
        success: true,
        value: null,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      expect(result).toBeNull();
    });

    it('should return null and not cache invalid value (NaN)', async () => {
      const mockResponse = {
        success: true,
        value: 'invalid',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      expect(result).toBeNull();
      
      // Cache should not be populated with invalid value
      const cachedValue = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(cachedValue).toBe(15); // Should still be default
    });

    it('should return null and not cache negative value', async () => {
      const mockResponse = {
        success: true,
        value: '-10',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      expect(result).toBeNull();
      
      // Cache should not be populated with negative value
      const cachedValue = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(cachedValue).toBe(15); // Should still be default
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      expect(result).toBeNull();
    });

    it('should cache zero value when returned from API', async () => {
      const mockResponse = {
        success: true,
        value: '0',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      expect(result).toBe(0);
      
      // Verify cache was populated with 0
      const cachedValue = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(cachedValue).toBe(0);
    });
  });

  describe('saveVisibilityMinutesToStrapi', () => {
    it('should save valid value to API and update cache', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await completedTaskVisibilityConfig.saveVisibilityMinutesToStrapi(1440);
      
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'completedTaskVisibilityMinutes',
          value: '1440',
        }),
      });
      
      // Verify cache was updated
      const cachedValue = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(cachedValue).toBe(1440);
    });

    it('should reject negative values without making API call', async () => {
      const result = await completedTaskVisibilityConfig.saveVisibilityMinutesToStrapi(-10);
      
      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should save zero value successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await completedTaskVisibilityConfig.saveVisibilityMinutesToStrapi(0);
      
      expect(result).toBe(true);
      
      // Verify cache was updated
      const cachedValue = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(cachedValue).toBe(0);
    });

    it('should return false on failed API response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await completedTaskVisibilityConfig.saveVisibilityMinutesToStrapi(1440);
      
      expect(result).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await completedTaskVisibilityConfig.saveVisibilityMinutesToStrapi(1440);
      
      expect(result).toBe(false);
    });

    it('should not update cache if API call fails', async () => {
      // Set initial cache value
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(60);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await completedTaskVisibilityConfig.saveVisibilityMinutesToStrapi(1440);
      
      // Cache should not have changed
      const cachedValue = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(cachedValue).toBe(60);
    });
  });

  describe('Bug Fix Regression Test: Initial Page Load', () => {
    it('should return default value when cache is not initialized (initial load scenario)', async () => {
      // This tests the original bug: on initial page load, cache is null
      // and without calling fetchVisibilityMinutesFromStrapi(), it would use default
      
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      expect(result).toBe(15); // Default value
    });

    it('should use correct value after fetchVisibilityMinutesFromStrapi is called', async () => {
      // This tests the fix: after calling fetchVisibilityMinutesFromStrapi,
      // the cache should be populated and used
      
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Simulate what the fix does: fetch settings first
      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      // Now getCompletedTaskVisibilityMinutes should return cached value
      const result = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      
      expect(result).toBe(1440); // Actual Strapi value, not default
    });

    it('should demonstrate the difference between initialized and uninitialized cache', async () => {
      // Before initialization
      const beforeFetch = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(beforeFetch).toBe(15); // Default
      
      // Initialize cache
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      // After initialization
      const afterFetch = completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes();
      expect(afterFetch).toBe(1440); // Correct value from Strapi
      
      // This demonstrates the bug: before fetch, it was 15; after fetch, it's 1440
      expect(beforeFetch).not.toBe(afterFetch);
    });
  });

  describe('Integration: Cache Persistence', () => {
    it('should maintain cached value across multiple calls', async () => {
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(1440);
      
      // Multiple calls should return same cached value
      expect(completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes()).toBe(1440);
      expect(completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes()).toBe(1440);
      expect(completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes()).toBe(1440);
    });

    it('should update cache when new value is fetched from API', async () => {
      // Initial cache
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(60);
      expect(completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes()).toBe(60);
      
      // Fetch new value
      const mockResponse = {
        success: true,
        value: '1440',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await completedTaskVisibilityConfig.fetchVisibilityMinutesFromStrapi();
      
      // Cache should be updated
      expect(completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes()).toBe(1440);
    });

    it('should update cache when value is saved to API', async () => {
      // Initial cache
      completedTaskVisibilityConfig.setCachedVisibilityMinutes(60);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await completedTaskVisibilityConfig.saveVisibilityMinutesToStrapi(1440);
      
      // Cache should be updated
      expect(completedTaskVisibilityConfig.getCompletedTaskVisibilityMinutes()).toBe(1440);
    });
  });
});
