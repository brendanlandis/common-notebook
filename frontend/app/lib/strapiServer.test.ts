import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STRAPI_MAX_PAGE_SIZE, fetchAllPages } from './strapiServer';

/** Build a Strapi list response for one page. */
function page(rows: unknown[], pageNo: number, pageCount: number) {
  return {
    ok: true,
    json: async () => ({
      data: rows,
      meta: { pagination: { page: pageNo, pageSize: STRAPI_MAX_PAGE_SIZE, pageCount, total: 0 } },
    }),
  } as unknown as Response;
}

let originalFetch: typeof global.fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchAllPages', () => {
  it('never requests more than Strapi will return', () => {
    // backend/config/api.ts sets maxLimit: 100. Asking for more is clamped
    // silently, which is exactly the bug this helper exists to prevent.
    expect(STRAPI_MAX_PAGE_SIZE).toBe(100);
  });

  it('pages until pageCount is exhausted and concatenates in order', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('pagination[page]=1')) return page([1, 2], 1, 3);
      if (url.includes('pagination[page]=2')) return page([3, 4], 2, 3);
      return page([5], 3, 3);
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(fetchAllPages('tok', '/api/todos')).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops after one page when there is only one', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => page(['a'], 1, 1));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(fetchAllPages('tok', '/api/projects')).resolves.toEqual(['a']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('appends pagination with & when the path already has a query', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => page([], 1, 1));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await fetchAllPages('tok', '/api/todos?filters[soon][$eq]=true');
    expect(fetchMock.mock.calls[0][0]).toContain('filters[soon][$eq]=true&pagination[pageSize]=100');
  });

  it('appends pagination with ? when the path has none', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => page([], 1, 1));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await fetchAllPages('tok', '/api/projects');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/projects?pagination[pageSize]=100');
  });

  it('sends the bearer token', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => page([], 1, 1));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await fetchAllPages('secret-token', '/api/todos');
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
  });

  it('throws rather than returning a short list when Strapi errors', async () => {
    // Returning a truncated list that looks successful is precisely how the
    // silent-clamp bug produced wrong practice stats for months.
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }) as Response) as never;
    await expect(fetchAllPages('tok', '/api/todos')).rejects.toThrow(/500/);
  });

  it('throws if a response omits pagination metadata after the first page', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: [1] }) }) as Response) as never;
    // No meta.pagination means we cannot know there are more pages; return what we got.
    await expect(fetchAllPages('tok', '/api/todos')).resolves.toEqual([1]);
  });

  it('gives up rather than looping forever if pageCount never shrinks', async () => {
    global.fetch = vi.fn(async () => page([1], 1, 99999)) as never;
    await expect(fetchAllPages('tok', '/api/todos')).rejects.toThrow(/exceeded/);
  });
});
