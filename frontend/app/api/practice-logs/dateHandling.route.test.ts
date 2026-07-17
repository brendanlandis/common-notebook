import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as statsGET } from './stats/route';
import { POST as stopPOST } from './[documentId]/stop/route';

process.env.STRAPI_API_URL = 'http://localhost:1337';

// Real dateUtils / getTimeZoneSettings; settings resolve to EST / 4am defaults
// because the mocked fetch returns no system-setting rows.

function request(url: string, method = 'GET'): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'), { method });
  vi.spyOn(req.cookies, 'get').mockImplementation(
    (name: string) => (name === 'auth_token' ? ({ value: 'test-token', name } as any) : undefined)
  );
  return req;
}

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = handler(String(input), init);
    return { ok: true, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('practice-logs stats route — 30-day range', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T18:00:00.000Z')); // effective day 2026-07-17
  });

  it('builds exactly 30 distinct consecutive day buckets ending today', async () => {
    mockFetch(() => ({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }));
    const res = await statsGET(request('http://localhost/api/practice-logs/stats'));
    const body = await res.json();

    const days = body.data[0].data.map((d: any) => d.date);
    expect(days).toHaveLength(30);
    expect(new Set(days).size).toBe(30); // no duplicate/dropped key (the boundary-0 loop bug)
    expect(days[0]).toBe('2026-06-18'); // 29 days back
    expect(days[29]).toBe('2026-07-17'); // today
  });

  it('filters practice logs from the start of the window (date-typed field, a bare date is correct)', async () => {
    const spy = mockFetch(() => ({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }));
    await statsGET(request('http://localhost/api/practice-logs/stats'));
    const call = spy.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/api/practice-logs?'))!;
    expect(call).toContain('filters[date][$gte]=2026-06-18');
  });
});

describe('practice-logs stop route — R3 evening session day attribution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Stop happens later; the session's *day* comes from its start, not stop.
    vi.setSystemTime(new Date('2026-07-18T04:00:00.000Z'));
  });

  it('attributes an evening session to the day it started, not the UTC date of the start', async () => {
    // Start 2026-07-17 23:30 EDT = 2026-07-18T03:30Z. The old code took the UTC
    // date ('2026-07-18'); the effective day in EST is 2026-07-17.
    const start = '2026-07-18T03:30:00.000Z';
    let putDate: string | undefined;
    mockFetch((url, init) => {
      if (init?.method === 'PUT') {
        putDate = JSON.parse(String(init.body)).data.date;
        return { data: { documentId: 'log-1', date: putDate } };
      }
      return { data: { documentId: 'log-1', start } }; // GET the log
    });

    const res = await stopPOST(request('http://localhost/api/practice-logs/log-1/stop', 'POST'), {
      params: Promise.resolve({ documentId: 'log-1' }),
    });
    expect((await res.json()).success).toBe(true);
    expect(putDate).toBe('2026-07-17');
  });
});
