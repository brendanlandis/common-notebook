import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as startPOST } from './route';
import { POST as switchPOST } from './[documentId]/switch/route';
import { POST as notePOST } from './[documentId]/note/route';
import { POST as loggedPOST } from './logged/route';

vi.mock('@/app/lib/strapiAuth', async (importOriginal) =>
  (await import('@/app/lib/testTokens')).cookieSession(await importOriginal())
);

process.env.STRAPI_API_URL = 'http://localhost:1337';

/**
 * Sessions — the sittings — and the intents that move a practice session across
 * pieces. What matters: every stretch lands in the right sitting, a switch keeps
 * the clock's minutes on the piece that earned them, a replayed switch does no
 * harm, and a tempo reached moves the piece's tempo.
 */

function request(url: string, body?: unknown): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  vi.spyOn(req.cookies, 'get').mockImplementation(((name: string) =>
    name === 'auth_token' ? { value: 'test-token', name } : undefined) as never);
  return req;
}

const params = (documentId: string) => ({ params: Promise.resolve({ documentId }) });

type Row = { documentId: string } & Record<string, unknown>;

/**
 * A Strapi stand-in with three tables. Relations are stored as documentIds and
 * expanded on read, which is all these routes ask of populate.
 */
function fakeStrapi() {
  const logs = new Map<string, Row>();
  const sessions = new Map<string, Row>();
  const tasks = new Map<string, Row>([
    ['reversal', { documentId: 'reversal', title: 'Receive - Reversal', tempo: 140, project: 'guitar' }],
    ['dyad', { documentId: 'dyad', title: 'dyad exercise', tempo: null, project: 'guitar' }],
  ]);
  let next = 1;

  const expandLog = (row: Row) => ({
    ...row,
    material: tasks.get(row.material as string) ?? null,
    session: row.session ? sessions.get(row.session as string) ?? null : null,
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // The base URL is read before the test sets it, so match from `/api/` on.
      const raw = String(input);
      const path = raw.slice(raw.indexOf('/api/')).split('?')[0];
      const ok = (data: unknown) => ({ ok: true, json: async () => ({ data }) }) as Response;
      const body = init?.body ? JSON.parse(String(init.body)).data : undefined;

      if (path.startsWith('/api/system-settings')) return ok([]);

      if (path === '/api/practice-sessions' && init?.method === 'POST') {
        const row: Row = { documentId: `s${next++}`, ...body };
        sessions.set(row.documentId, row);
        return ok(row);
      }
      if (path === '/api/practice-logs' && init?.method === 'POST') {
        const row: Row = { documentId: `l${next++}`, ...body };
        logs.set(row.documentId, row);
        return ok(expandLog(row));
      }
      if (path === '/api/practice-logs') {
        // The open-session lookup.
        const open = [...logs.values()].filter((l) => !l.stop).reverse();
        return ok(open.slice(0, 1).map(expandLog));
      }
      const log = path.match(/^\/api\/practice-logs\/(.+)$/);
      if (log) {
        const row = logs.get(log[1]);
        if (!row) return { ok: false, json: async () => ({}) } as Response;
        if (init?.method === 'PUT') Object.assign(row, body);
        return ok(expandLog(row));
      }
      const task = path.match(/^\/api\/tasks\/(.+)$/);
      if (task) {
        const row = tasks.get(task[1])!;
        if (init?.method === 'PUT') Object.assign(row, body);
        return ok({ ...row, project: { documentId: row.project } });
      }
      throw new Error(`unexpected fetch ${init?.method ?? 'GET'} ${path}`);
    })
  );

  return { logs, sessions, tasks };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T15:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function start(material: string) {
  const res = await startPOST(request('/api/practice-logs', { material }));
  return (await res.json()).data;
}

describe('start', () => {
  it('opens a sitting under the piece’s subject and files the first stretch in it', async () => {
    const { sessions, logs } = fakeStrapi();
    const log = await start('reversal');

    expect(sessions.size).toBe(1);
    const [sitting] = sessions.values();
    expect(sitting).toMatchObject({ subject: 'guitar', date: '2026-09-30' });
    expect(logs.get(log.documentId)).toMatchObject({ session: sitting.documentId, stop: null });
  });
});

describe('switch', () => {
  it('banks the minutes on the piece left, and opens the next in the same sitting', async () => {
    const { sessions, logs } = fakeStrapi();
    const first = await start('reversal');
    vi.setSystemTime(new Date('2026-09-30T15:18:00.000Z'));

    const res = await switchPOST(
      request(`/api/practice-logs/${first.documentId}/switch`, { material: 'dyad' }),
      params(first.documentId)
    );
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(logs.get(first.documentId)).toMatchObject({
      stop: '2026-09-30T15:18:00.000Z',
      duration: 18,
    });
    expect(logs.get(body.data.documentId)).toMatchObject({
      material: 'dyad',
      session: first.session.documentId,
      stop: null,
    });
    expect(sessions.size).toBe(1);
  });

  it('switching to the piece already running changes nothing', async () => {
    const { logs } = fakeStrapi();
    const first = await start('reversal');
    const res = await switchPOST(
      request(`/api/practice-logs/${first.documentId}/switch`, { material: 'reversal' }),
      params(first.documentId)
    );
    expect((await res.json()).success).toBe(true);
    expect(logs.size).toBe(1);
    expect(logs.get(first.documentId)!.stop).toBeNull();
  });

  it('a replayed switch returns the stretch it already opened', async () => {
    const { logs } = fakeStrapi();
    const first = await start('reversal');
    const url = `/api/practice-logs/${first.documentId}/switch`;
    const once = await (await switchPOST(request(url, { material: 'dyad' }), params(first.documentId))).json();
    const twice = await (await switchPOST(request(url, { material: 'dyad' }), params(first.documentId))).json();

    expect(twice.success).toBe(true);
    expect(twice.data.documentId).toBe(once.data.documentId);
    expect(logs.size).toBe(2);
  });

  it('refuses to reopen a finished session', async () => {
    const { logs } = fakeStrapi();
    const first = await start('reversal');
    Object.assign(logs.get(first.documentId)!, { stop: '2026-09-30T15:10:00.000Z' });

    const res = await switchPOST(
      request(`/api/practice-logs/${first.documentId}/switch`, { material: 'dyad' }),
      params(first.documentId)
    );
    expect(res.status).toBe(409);
    expect(logs.size).toBe(1);
  });
});

describe('note', () => {
  it('saves the note as a paragraph, and moves the piece’s tempo to the tempo reached', async () => {
    const { logs, tasks } = fakeStrapi();
    const first = await start('reversal');

    const res = await notePOST(
      request(`/api/practice-logs/${first.documentId}/note`, {
        notes: 'bridge is clean at 150',
        tempoReached: 150,
      }),
      params(first.documentId)
    );

    expect((await res.json()).success).toBe(true);
    expect(logs.get(first.documentId)).toMatchObject({
      tempoReached: 150,
      notes: [{ type: 'paragraph', children: [{ type: 'text', text: 'bridge is clean at 150' }] }],
    });
    expect(tasks.get('reversal')!.tempo).toBe(150);
  });

  it('refuses a tempo that isn’t a whole number of bpm', async () => {
    fakeStrapi();
    const res = await notePOST(
      request('/api/practice-logs/l1/note', { tempoReached: 'fast' }),
      params('l1')
    );
    expect(res.status).toBe(400);
  });
});

describe('logged afterwards', () => {
  it('makes a finished sitting of one stretch, on the day given', async () => {
    const { sessions, logs, tasks } = fakeStrapi();
    const res = await loggedPOST(
      request('/api/practice-logs/logged', {
        material: 'reversal',
        date: '2026-09-29',
        minutes: 20,
        tempoReached: 144,
        notes: 'practiced at a friend’s',
      })
    );

    expect((await res.json()).success).toBe(true);
    const [sitting] = sessions.values();
    const [log] = logs.values();
    expect(sitting).toMatchObject({ date: '2026-09-29', subject: 'guitar' });
    expect(log).toMatchObject({
      session: sitting.documentId,
      date: '2026-09-29',
      duration: 20,
      tempoReached: 144,
      segments: [],
    });
    // Midday in the account's zone (the EST default): it has to sort, and that's all.
    expect(log.start).toBe('2026-09-29T16:00:00Z');
    expect(log.stop).toBe(log.start);
    expect(tasks.get('reversal')!.tempo).toBe(144);
  });

  it('refuses minutes that aren’t a whole positive number', async () => {
    fakeStrapi();
    for (const minutes of [0, -5, 2.5, '20']) {
      const res = await loggedPOST(
        request('/api/practice-logs/logged', { material: 'reversal', date: '2026-09-29', minutes })
      );
      expect(res.status).toBe(400);
    }
  });
});
