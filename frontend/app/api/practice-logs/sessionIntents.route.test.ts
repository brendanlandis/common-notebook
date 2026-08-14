import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as pausePOST } from './[documentId]/pause/route';
import { POST as resumePOST } from './[documentId]/resume/route';
import { POST as stopPOST } from './[documentId]/stop/route';
import { POST as correctPOST } from './[documentId]/correct/route';
import { POST as startPOST } from './route';

process.env.STRAPI_API_URL = 'http://localhost:1337';

/**
 * The intent endpoints, exercised for **idempotency**.
 *
 * This is the property the whole design rests on: a session is shared between
 * devices, so the phone in your pocket will re-assert things the computer has
 * already moved past. Pausing a paused session, stopping a stopped one and
 * resuming a running one must all be no-ops — a stale client may only ever
 * re-state something already true, never resurrect a session that ended.
 */

function request(url: string, body?: unknown): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  vi.spyOn(req.cookies, 'get').mockImplementation(
    (name: string) => (name === 'auth_token' ? ({ value: 'test-token', name } as any) : undefined)
  );
  return req;
}

const params = (documentId: string) => ({ params: Promise.resolve({ documentId }) });

/**
 * A Strapi stand-in holding one mutable session row.
 *
 * Writes are merged into the row exactly as Strapi would, so a second call
 * genuinely reads back what the first one wrote — which is the only way to test
 * that doing something twice differs from doing it once.
 */
function mockStrapi(initial: Record<string, unknown>) {
  const row: Record<string, unknown> = { documentId: 'log-1', ...initial };
  const writes: Record<string, unknown>[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      // System settings: no rows, so readers fall back to the EST / 4am defaults.
      if (url.includes('/api/system-settings')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      // The open-session lookup used by the start route.
      if (url.includes('filters[stop][$null]=true')) {
        return {
          ok: true,
          json: async () => ({ data: row.stop ? [] : [row] }),
        } as Response;
      }

      if (init?.method === 'PUT') {
        const data = JSON.parse(String(init.body)).data;
        writes.push(data);
        Object.assign(row, data);
        return { ok: true, json: async () => ({ data: row }) } as Response;
      }

      if (init?.method === 'POST') {
        const data = JSON.parse(String(init.body)).data;
        writes.push(data);
        return { ok: true, json: async () => ({ data: { documentId: 'new-1', ...data } }) } as Response;
      }

      return { ok: true, json: async () => ({ data: row }) } as Response;
    })
  );

  return { row, writes };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-14T15:00:00.000Z'));
});

describe('pause', () => {
  it('closes the running stretch and banks the duration', async () => {
    const { row, writes } = mockStrapi({
      start: '2026-08-14T14:00:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-14T14:00:00.000Z', stop: null }],
    });

    const res = await pausePOST(request('/api/practice-logs/log-1/pause'), params('log-1'));
    expect((await res.json()).success).toBe(true);
    expect(writes).toHaveLength(1);
    expect((row.segments as any)[0].stop).toBe('2026-08-14T15:00:00.000Z');
    // Duration is written on pause, not only on stop, so an abandoned session
    // still reports what was actually practised.
    expect(row.duration).toBe(60);
  });

  it('pausing twice writes once and does not move the stop time', async () => {
    const { row, writes } = mockStrapi({
      start: '2026-08-14T14:00:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-14T14:00:00.000Z', stop: null }],
    });

    await pausePOST(request('/api/practice-logs/log-1/pause'), params('log-1'));
    vi.setSystemTime(new Date('2026-08-14T16:00:00.000Z'));
    const res = await pausePOST(request('/api/practice-logs/log-1/pause'), params('log-1'));

    expect((await res.json()).success).toBe(true);
    expect(writes).toHaveLength(1);
    expect((row.segments as any)[0].stop).toBe('2026-08-14T15:00:00.000Z');
    expect(row.duration).toBe(60); // not 120
  });
});

describe('resume', () => {
  it('opens a new stretch', async () => {
    const { row } = mockStrapi({
      start: '2026-08-14T14:00:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:30:00.000Z' }],
    });

    const res = await resumePOST(request('/api/practice-logs/log-1/resume'), params('log-1'));
    expect((await res.json()).success).toBe(true);
    expect(row.segments).toHaveLength(2);
    expect((row.segments as any)[1]).toEqual({ start: '2026-08-14T15:00:00.000Z', stop: null });
  });

  it('resuming a running session writes nothing', async () => {
    const { writes } = mockStrapi({
      start: '2026-08-14T14:00:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-14T14:00:00.000Z', stop: null }],
    });

    const res = await resumePOST(request('/api/practice-logs/log-1/resume'), params('log-1'));
    expect((await res.json()).success).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it('refuses to reopen a finished session', async () => {
    // Re-opening a row whose duration is banked would hang a second, later
    // stretch off a session that is already counted.
    mockStrapi({
      start: '2026-08-14T14:00:00.000Z',
      stop: '2026-08-14T14:30:00.000Z',
      segments: [{ start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:30:00.000Z' }],
    });

    const res = await resumePOST(request('/api/practice-logs/log-1/resume'), params('log-1'));
    expect(res.status).toBe(409);
  });
});

describe('stop', () => {
  it('sums the segments rather than measuring stop minus start', async () => {
    // Ninety minutes of wall time, twenty-five practised. This is the whole
    // reason duration is no longer `stop - start`.
    const { row } = mockStrapi({
      start: '2026-08-14T13:30:00.000Z',
      stop: null,
      segments: [
        { start: '2026-08-14T13:30:00.000Z', stop: '2026-08-14T13:50:00.000Z' },
        { start: '2026-08-14T14:55:00.000Z', stop: null },
      ],
    });

    const res = await stopPOST(request('/api/practice-logs/log-1/stop'), params('log-1'));
    expect((await res.json()).success).toBe(true);
    expect(row.duration).toBe(25);
    expect(row.stop).toBe('2026-08-14T15:00:00.000Z');
  });

  it('stopping twice does not move the stop time or the duration', async () => {
    const { row, writes } = mockStrapi({
      start: '2026-08-14T14:00:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-14T14:00:00.000Z', stop: null }],
    });

    await stopPOST(request('/api/practice-logs/log-1/stop'), params('log-1'));
    vi.setSystemTime(new Date('2026-08-14T17:00:00.000Z'));
    const res = await stopPOST(request('/api/practice-logs/log-1/stop'), params('log-1'));

    expect((await res.json()).success).toBe(true);
    expect(writes).toHaveLength(1);
    expect(row.stop).toBe('2026-08-14T15:00:00.000Z');
    expect(row.duration).toBe(60);
  });

  it('files the session under the effective day it started', async () => {
    // Start 2026-08-14 23:30 EDT = 2026-08-15T03:30Z, stopped after midnight UTC.
    // The UTC date is the 15th; the effective day in EST is still the 14th.
    vi.setSystemTime(new Date('2026-08-15T04:00:00.000Z'));
    const { row } = mockStrapi({
      start: '2026-08-15T03:30:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-15T03:30:00.000Z', stop: null }],
    });

    await stopPOST(request('/api/practice-logs/log-1/stop'), params('log-1'));
    expect(row.date).toBe('2026-08-14');
  });
});

describe('correct', () => {
  it('takes the caller’s minutes and closes the session', async () => {
    const { row } = mockStrapi({
      start: '2026-08-14T06:00:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-14T06:00:00.000Z', stop: null }],
    });

    const res = await correctPOST(
      request('/api/practice-logs/log-1/correct', { minutes: 45 }),
      params('log-1')
    );
    expect((await res.json()).success).toBe(true);
    expect(row.duration).toBe(45); // not the nine hours the clock ran
    expect(row.stop).toBe('2026-08-14T15:00:00.000Z');
  });

  it('keeps the segments as evidence rather than rewriting them to match', async () => {
    const { row } = mockStrapi({
      start: '2026-08-14T06:00:00.000Z',
      stop: null,
      segments: [{ start: '2026-08-14T06:00:00.000Z', stop: null }],
    });

    await correctPOST(
      request('/api/practice-logs/log-1/correct', { minutes: 30 }),
      params('log-1')
    );
    expect((row.segments as any)[0]).toEqual({
      start: '2026-08-14T06:00:00.000Z',
      stop: '2026-08-14T15:00:00.000Z',
    });
  });

  it.each([
    ['not a number', { minutes: 'lots' }],
    ['negative', { minutes: -5 }],
    ['more than a day', { minutes: 2000 }],
    ['missing', {}],
  ])('rejects %s', async (_label, body) => {
    mockStrapi({ start: '2026-08-14T14:00:00.000Z', stop: null, segments: [] });
    const res = await correctPOST(
      request('/api/practice-logs/log-1/correct', body),
      params('log-1')
    );
    expect(res.status).toBe(400);
  });
});

describe('start', () => {
  it('stamps start, effective day and a first segment server-side', async () => {
    const { writes } = mockStrapi({ stop: '2026-08-13T00:00:00.000Z' }); // nothing open

    const res = await startPOST(request('/api/practice-logs', { material: 'task-1' }));
    expect((await res.json()).success).toBe(true);

    expect(writes[0]).toMatchObject({
      material: 'task-1',
      start: '2026-08-14T15:00:00.000Z',
      stop: null,
      duration: 0,
      date: '2026-08-14',
      segments: [{ start: '2026-08-14T15:00:00.000Z', stop: null }],
    });
  });

  it('refuses a second session while one is running, and hands back the open one', async () => {
    // Two running sessions is not a state the modal can render or the totals can
    // survive, so the caller is given the one that already exists.
    mockStrapi({ documentId: 'log-1', start: '2026-08-14T14:00:00.000Z', stop: null });

    const res = await startPOST(request('/api/practice-logs', { material: 'task-2' }));
    expect(res.status).toBe(409);
    expect((await res.json()).data.documentId).toBe('log-1');
  });

  it('requires a material', async () => {
    mockStrapi({ stop: '2026-08-13T00:00:00.000Z' });
    const res = await startPOST(request('/api/practice-logs', {}));
    expect(res.status).toBe(400);
  });
});
