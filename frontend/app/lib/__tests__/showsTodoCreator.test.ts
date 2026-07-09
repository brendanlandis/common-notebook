import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTodosFromShows } from '../showsTodoCreator';

vi.mock('../dateUtils', () => ({
  getNowInEST: () => new Date('2026-07-09T12:00:00.000Z'),
  toISODateInEST: (d: Date) => d.toISOString().slice(0, 10),
}));

/** Every URL the function could touch, so a leak shows up as an unexpected call. */
function fetchSpy(handlers: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [prefix, body] of Object.entries(handlers)) {
      if (url.startsWith(prefix)) {
        return { ok: true, json: async () => body } as Response;
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const calls = (spy: ReturnType<typeof fetchSpy>) =>
  spy.mock.calls.map(([input]) => String(input));

describe('createTodosFromShows — identity gate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing at all when the server says the feature is off', async () => {
    const spy = fetchSpy({ '/api/shows-todos': { success: true, enabled: false } });
    vi.stubGlobal('fetch', spy);

    const result = await createTodosFromShows();

    expect(result).toEqual({ success: true, todosCreated: 0, showsProcessed: 0, skipped: true });
    // The one call is the gate. Critically, no system-settings row is written and
    // no todo is created — a new user's account stays untouched.
    expect(calls(spy)).toEqual(['/api/shows-todos']);
  });

  it('fails closed when the gate errors', async () => {
    const spy = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', spy);

    const result = await createTodosFromShows();

    expect(result.skipped).toBe(true);
    expect(result.todosCreated).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the gate returns a non-OK response', async () => {
    const spy = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response);
    vi.stubGlobal('fetch', spy);

    expect((await createTodosFromShows()).skipped).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('proceeds past the gate when enabled, and stops early once up to date', async () => {
    const spy = fetchSpy({
      '/api/shows-todos': { success: true, enabled: true },
      // Already checked today, so it must not fetch shows or create todos.
      '/api/system-settings': { success: true, date: '2026-07-09' },
    });
    vi.stubGlobal('fetch', spy);

    const result = await createTodosFromShows();

    expect(result).toMatchObject({ success: true, todosCreated: 0, showsProcessed: 0 });
    expect(calls(spy)).toEqual([
      '/api/shows-todos',
      '/api/system-settings?title=lastShowTodosCheck',
    ]);
  });
});
