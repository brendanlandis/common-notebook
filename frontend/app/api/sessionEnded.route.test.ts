// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SessionEndedError } from '@/app/lib/authErrors';
import { errorResponse } from '@/app/lib/errorResponse';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';

// These test what a refused token does, not auth: the auth_token cookie stands in
// for a session this server verified (strapiAuth.test.ts covers verification).
vi.mock('@/app/lib/strapiAuth', async (importOriginal) =>
  (await import('@/app/lib/testTokens')).cookieSession(await importOriginal())
);

import { GET as getTasks } from './tasks/route';
import { PUT as putTask } from './tasks/[documentId]/route';
import { GET as getMe } from './me/route';
import { GET as getSetting } from './system-settings/route';

/** Strapi answering every request with `status`, as it does for a blocked or deleted user's token. */
function strapiAnswers(status: number) {
  const fetchMock = vi.fn(async () => Response.json({ error: { status, message: 'Invalid credentials' } }, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const request = (path: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    headers: { cookie: 'auth_token=a-verified-token; refresh_token=r1', 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

const clearsBothCookies = (res: Response) =>
  ['auth_token', 'refresh_token'].every((name) =>
    res.headers.getSetCookie().some((c) => c.startsWith(`${name}=;`) && /Max-Age=0/i.test(c))
  );

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('strapiFetch', () => {
  it('throws SessionEndedError when Strapi refuses the token', async () => {
    strapiAnswers(401);
    await expect(strapiFetch('t', '/api/tasks?x=1')).rejects.toBeInstanceOf(SessionEndedError);
    await expect(fetchAllPages('t', '/api/tasks')).rejects.toBeInstanceOf(SessionEndedError);
  });

  it('hands back every other answer for the caller to read', async () => {
    for (const status of [403, 404, 500]) {
      strapiAnswers(status);
      expect((await strapiFetch('t', '/api/tasks')).status).toBe(status);
    }
  });
});

describe('a blocked or deleted user', () => {
  it.each([
    ['GET /api/tasks', () => getTasks(request('/api/tasks'))],
    ['PUT /api/tasks/:id', () =>
      putTask(request('/api/tasks/abc', { method: 'PUT', body: { title: 'x' } }), {
        params: Promise.resolve({ documentId: 'abc' }),
      })],
    ['GET /api/system-settings', () => getSetting(request('/api/system-settings?title=timezone'))],
    // Used to answer 200 with betaAccess: false.
    ['GET /api/me', () => getMe(request('/api/me'))],
  ])('gets a 401 that clears the cookies from %s, not a 500 or an empty answer', async (_, call) => {
    strapiAnswers(401);
    const res = await call();
    expect(res.status).toBe(401);
    expect(clearsBothCookies(res)).toBe(true);
  });
});

describe('errorResponse', () => {
  it('answers anything else 500, without touching the cookies', async () => {
    const res = errorResponse('Error doing a thing:', new Error('boom'));
    expect(res.status).toBe(500);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('Error doing a thing:', expect.any(Error));
  });
});
