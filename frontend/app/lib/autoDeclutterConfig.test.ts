import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as mod from './autoDeclutterConfig';

global.fetch = vi.fn();
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe('autoDeclutterConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchAutoDeclutterFromStrapi', () => {
    it('parses "false" as disabled', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, value: 'false' }));
      expect(await mod.fetchAutoDeclutterFromStrapi()).toBe(false);
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
      // The second fetch is the seeding PUT, which now goes through the
      // arming-aware endpoint like every other write of this setting.
      const [putUrl, putInit] = mockFetch.mock.calls[1];
      expect(putUrl).toBe('/api/auto-declutter');
      expect(putInit.method).toBe('PUT');
      expect(JSON.parse(putInit.body)).toEqual({ enabled: true });
    });

    it('returns null on a failed request', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, false));
      expect(await mod.fetchAutoDeclutterFromStrapi()).toBeNull();
    });
  });

  describe('saveAutoDeclutterToStrapi', () => {
    it('PUTs to the auto-declutter endpoint, not the generic settings one', async () => {
      // The dedicated endpoint is what arms the declutter watermark when the
      // setting is switched on. Writing this setting through
      // /api/system-settings would save the value and skip the arming, which is
      // the bug where enabling auto-declutter decluttered immediately.
      mockFetch.mockResolvedValueOnce(jsonResponse({}, true));
      const ok = await mod.saveAutoDeclutterToStrapi(false);
      expect(ok).toBe(true);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/auto-declutter');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ enabled: false });
    });

    it('reports failure when the request is rejected', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, false));
      expect(await mod.saveAutoDeclutterToStrapi(true)).toBe(false);
    });
  });
});
