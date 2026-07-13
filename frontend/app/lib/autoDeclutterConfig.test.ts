import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Module state (the cache) is module-level, so reimport between tests to reset.
let mod: typeof import('./autoDeclutterConfig');

global.fetch = vi.fn();
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe('autoDeclutterConfig', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mod = await import('./autoDeclutterConfig');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAutoDeclutter', () => {
    it('defaults to true when the cache is empty', () => {
      expect(mod.getAutoDeclutter()).toBe(true);
    });

    it('returns the cached value once set', () => {
      mod.setCachedAutoDeclutter(false);
      expect(mod.getAutoDeclutter()).toBe(false);
    });
  });

  describe('fetchAutoDeclutterFromStrapi', () => {
    it('parses "false" as disabled and caches it', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, value: 'false' }));
      const result = await mod.fetchAutoDeclutterFromStrapi();
      expect(result).toBe(false);
      expect(mod.getAutoDeclutter()).toBe(false);
    });

    it('parses "true" as enabled', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, value: 'true' }));
      expect(await mod.fetchAutoDeclutterFromStrapi()).toBe(true);
    });

    it('seeds the default (true) when the setting does not exist', async () => {
      // First call: GET returns no value. Second call: the PUT that seeds it.
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ success: true, value: null }))
        .mockResolvedValueOnce(jsonResponse({}, true));
      const result = await mod.fetchAutoDeclutterFromStrapi();
      expect(result).toBe(true);
      // The second fetch is the seeding PUT with value 'true'.
      const [, putInit] = mockFetch.mock.calls[1];
      expect(putInit.method).toBe('PUT');
      expect(JSON.parse(putInit.body)).toEqual({ title: 'autoDeclutter', value: 'true' });
    });

    it('returns null on a failed request', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, false));
      expect(await mod.fetchAutoDeclutterFromStrapi()).toBeNull();
    });
  });

  describe('saveAutoDeclutterToStrapi', () => {
    it('PUTs the boolean as a string and caches it', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, true));
      const ok = await mod.saveAutoDeclutterToStrapi(false);
      expect(ok).toBe(true);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/system-settings');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ title: 'autoDeclutter', value: 'false' });
      expect(mod.getAutoDeclutter()).toBe(false);
    });
  });
});
