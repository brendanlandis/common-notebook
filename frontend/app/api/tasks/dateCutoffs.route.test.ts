import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as completedGET } from './completed/route';
import { GET as upcomingGET } from './upcoming/route';
import { GET as longWithSessionsGET } from './long-with-sessions/route';

process.env.STRAPI_API_URL = 'http://localhost:1337';

// Real dateUtils / getTimeZoneSettings. Settings resolve to the EST / 4am defaults
// because the mocked fetch returns no system-setting rows. The clock is pinned so
// the cutoffs are deterministic, and the fall-back-week cases below only differ
// from the (buggy) machine-calendar arithmetic under a non-UTC user on a UTC host —
// which is why the whole suite also runs under TZ=UTC / NY / Kolkata.

function request(url: string): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'));
  vi.spyOn(req.cookies, 'get').mockImplementation(
    (name: string) => (name === 'auth_token' ? ({ value: 'test-token', name } as any) : undefined)
  );
  return req;
}

/** Capture every fetched URL; return empty pages, plus any per-prefix overrides. */
function mockFetch(overrides: Record<string, unknown> = {}) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [prefix, body] of Object.entries(overrides)) {
      if (url.includes(prefix)) return { ok: true, json: async () => body } as Response;
    }
    return {
      ok: true,
      json: async () => ({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }),
    } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

const urls = (spy: ReturnType<typeof mockFetch>) => spy.mock.calls.map(([u]) => String(u));
const paramFrom = (url: string, key: string) => {
  const m = url.match(new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^&]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('completed route — completedAt cutoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T18:00:00.000Z')); // 14:00 EDT, effective day 2026-07-17
  });

  it('sends a real UTC timestamp (EDT midnight of the cutoff day), not a bare date', async () => {
    const spy = mockFetch();
    await completedGET(request('http://localhost/api/tasks/completed?days=30'));
    const tasksCall = urls(spy).find((u) => u.includes('filters[completedAt][$gte]='))!;
    // today 2026-07-17 minus 30 days = 2026-06-17; EDT midnight = 04:00Z.
    expect(paramFrom(tasksCall, 'filters[completedAt][$gte]')).toBe('2026-06-17T04:00:00.000Z');
  });
});

describe('upcoming route — displayDate window across fall-back', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-10-30 14:00 EDT; DST ends 2026-11-01. today = 2026-10-30.
    vi.setSystemTime(new Date('2026-10-30T18:00:00.000Z'));
  });

  it('asks for tomorrow..+4 days as real calendar days, never collapsing tomorrow onto today', async () => {
    const spy = mockFetch();
    await upcomingGET(request('http://localhost/api/tasks/upcoming'));
    const call = urls(spy).find((u) => u.includes('filters[displayDate][$gte]='))!;
    expect(paramFrom(call, 'filters[displayDate][$gte]')).toBe('2026-10-31'); // tomorrow, not today
    expect(paramFrom(call, 'filters[displayDate][$lte]')).toBe('2026-11-03'); // +4 days, spans fall-back
  });
});

describe('long-with-sessions route — client-side work-session cutoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T18:00:00.000Z')); // effective day 2026-07-17
  });

  it('keeps only work sessions on/after the cutoff date (30 days back)', async () => {
    // Cutoff = 2026-07-17 − 30 = 2026-06-17. Sessions filter on the date-typed field.
    const task = {
      documentId: 'long-1',
      long: true,
      completed: false,
      workSessions: [
        { date: '2026-06-18', timestamp: '2026-06-18T14:00:00.000Z' }, // inside
        { date: '2026-06-16', timestamp: '2026-06-16T14:00:00.000Z' }, // outside
      ],
      project: { documentId: 'p1', title: 'P' },
    };
    mockFetch({ 'filters[long][$eq]=true': { data: [task], meta: { pagination: { page: 1, pageCount: 1 } } } });

    const res = await longWithSessionsGET(request('http://localhost/api/tasks/long-with-sessions?days=30'));
    const body = await res.json();
    const returned = body.data.find((t: any) => t.documentId === 'long-1');
    expect(returned.workSessions.map((s: any) => s.date)).toEqual(['2026-06-18']);
  });
});
