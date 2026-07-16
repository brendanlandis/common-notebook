import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseVisibilityMinutes, saveVisibilityMinutesToStrapi } from './completedTaskVisibilityConfig';

global.fetch = vi.fn();
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

/**
 * The cache this module used to hold is gone, and with it the suite that tested
 * it — including a "cache not initialized on initial page load" regression case.
 * That scenario is now unreachable: the window is resolved server-side in
 * `(main)/layout.tsx` and handed to `DateTimeSettingsProvider`, so no consumer can
 * observe an unprimed value. What's left to test is the coercion and the save.
 */
describe('completedTaskVisibilityConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseVisibilityMinutes', () => {
    it('falls back to the default (15) for a missing value', () => {
      expect(parseVisibilityMinutes(null)).toBe(15);
      expect(parseVisibilityMinutes(undefined)).toBe(15);
      expect(parseVisibilityMinutes('')).toBe(15);
    });

    it('parses a stored value', () => {
      expect(parseVisibilityMinutes('30')).toBe(30);
    });

    it('accepts zero — completed tasks vanish immediately', () => {
      expect(parseVisibilityMinutes('0')).toBe(0);
    });

    it('falls back for a non-numeric value', () => {
      expect(parseVisibilityMinutes('not-a-number')).toBe(15);
    });

    it('falls back for a negative value', () => {
      expect(parseVisibilityMinutes('-5')).toBe(15);
    });
  });

  describe('saveVisibilityMinutesToStrapi', () => {
    it('PUTs the value as a string', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
      const ok = await saveVisibilityMinutesToStrapi(30);
      expect(ok).toBe(true);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/system-settings');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({
        title: 'completedTaskVisibilityMinutes',
        value: '30',
      });
    });

    it('refuses a negative value without calling the API', async () => {
      expect(await saveVisibilityMinutesToStrapi(-1)).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports failure when the request is rejected', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response);
      expect(await saveVisibilityMinutesToStrapi(30)).toBe(false);
    });

    it('handles network errors gracefully', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('network down'));
      expect(await saveVisibilityMinutesToStrapi(30)).toBe(false);
    });
  });
});
