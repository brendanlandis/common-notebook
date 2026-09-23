// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The cookie jar route handlers write through. Outside a request scope the real
// one throws; here it records what was set.
const jar = { set: vi.fn(), get: vi.fn() };
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => jar) }));

import { NextRequest } from 'next/server';
import { AuthConfigError, SessionUnavailableError } from './authErrors';
import {
  getAccessToken,
  getAccessTokenServer,
  getCaller,
  issuedTokenVerifies,
  verifyAccessToken,
} from './strapiAuth';
import { signToken, unsignedToken } from './testTokens';

const request = (cookies: Record<string, string>) =>
  new NextRequest('http://localhost:3000/api/tasks', {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    },
  });

/** Strapi's /api/auth/refresh, answering with a fresh pair or a status. */
function strapiRefresh(answer: { status: number; access?: string; refresh?: string } | Error) {
  const fetchMock = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify({ jwt: answer.access, refreshToken: answer.refresh }), {
      status: answer.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const clearedCookies = () =>
  jar.set.mock.calls.filter(([, value, options]) => value === '' && options?.maxAge === 0).map(([n]) => n);

beforeEach(() => {
  jar.set.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('verifyAccessToken', () => {
  it('accepts a token Strapi signed that has not expired', async () => {
    const claims = await verifyAccessToken(await signToken({ userId: '7' }));
    expect(claims).toMatchObject({ userId: '7' });
    expect(claims!.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('reads a numeric userId as a string', async () => {
    expect(await verifyAccessToken(await signToken({ userId: 7 }))).toMatchObject({ userId: '7' });
  });

  it.each([
    ['an unsigned token (alg: none)', () => unsignedToken()],
    ['a token signed with another secret', () => signToken({ secret: 'someone-elses-secret-0123456789' })],
    ['HS512, even with the right secret', () => signToken({ alg: 'HS512' })],
    ['a refresh token', () => signToken({ type: 'refresh' })],
    ['an expired token', () => signToken({ expiresIn: -60 })],
    ['a token with no userId', () => signToken({ userId: '' })],
    ['an opaque string', async () => 'test-token'],
    ['three dots of nothing', async () => 'a.b.c'],
    ['an empty string', async () => ''],
  ])('refuses %s', async (_label, make) => {
    expect(await verifyAccessToken(await make())).toBeNull();
  });

  it('allows a few seconds of clock skew', async () => {
    expect(await verifyAccessToken(await signToken({ expiresIn: -3 }))).not.toBeNull();
  });

  it('throws AuthConfigError, rather than trusting anything, when JWT_SECRET is unset', async () => {
    const token = await signToken();
    vi.stubEnv('JWT_SECRET', '');
    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(AuthConfigError);
  });
});

describe('getCaller and getAccessToken', () => {
  it('returns a verified token and its user without asking Strapi', async () => {
    const fetchMock = strapiRefresh({ status: 500 });
    const access = await signToken({ userId: '4' });
    expect(await getCaller(request({ auth_token: access, refresh_token: 'r1' }))).toEqual({
      token: access,
      userId: '4',
    });
    expect(await getAccessToken(request({ auth_token: access }))).toBe(access);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token and writes both new cookies', async () => {
    const fresh = await signToken({ userId: '4' });
    const fetchMock = strapiRefresh({ status: 200, access: fresh, refresh: 'r2' });
    const caller = await getCaller(
      request({ auth_token: await signToken({ expiresIn: -60 }), refresh_token: 'r1' })
    );
    expect(caller).toEqual({ token: fresh, userId: '4' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jar.set).toHaveBeenCalledWith('auth_token', fresh, expect.anything());
    expect(jar.set).toHaveBeenCalledWith('refresh_token', 'r2', expect.anything());
  });

  it('takes a forged access cookie down the refresh path, never trusting its claims', async () => {
    const fresh = await signToken({ userId: '4' });
    const fetchMock = strapiRefresh({ status: 200, access: fresh, refresh: 'r2' });
    const caller = await getCaller(request({ auth_token: unsignedToken({ userId: '1' }), refresh_token: 'r1' }));
    expect(caller).toEqual({ token: fresh, userId: '4' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('has no caller for a forged access cookie with no refresh cookie', async () => {
    const fetchMock = strapiRefresh({ status: 500 });
    expect(await getCaller(request({ auth_token: unsignedToken({ userId: '1' }) }))).toBeNull();
    expect(await getAccessToken(request({ auth_token: 'test-token' }))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears both cookies when Strapi refuses the refresh: the session is over', async () => {
    strapiRefresh({ status: 401 });
    expect(await getCaller(request({ refresh_token: 'revoked' }))).toBeNull();
    expect(clearedCookies().sort()).toEqual(['auth_token', 'refresh_token']);
  });

  it.each([
    ['a 5xx', { status: 502 }],
    ['a timeout or network error', new Error('The operation was aborted due to timeout')],
  ])('throws SessionUnavailableError on %s, and leaves the cookies alone', async (_label, answer) => {
    strapiRefresh(answer as any);
    await expect(getCaller(request({ refresh_token: 'r1' }))).rejects.toBeInstanceOf(SessionUnavailableError);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it('keeps using an access token with seconds left when Strapi cannot be reached', async () => {
    strapiRefresh({ status: 503 });
    const nearlyExpired = await signToken({ userId: '4', expiresIn: 30 });
    expect(await getCaller(request({ auth_token: nearlyExpired, refresh_token: 'r1' }))).toEqual({
      token: nearlyExpired,
      userId: '4',
    });
  });

  it('throws AuthConfigError when a token Strapi just issued fails verification, and clears nothing', async () => {
    const otherSecret = await signToken({ secret: 'the-backends-different-secret-0123' });
    strapiRefresh({ status: 200, access: otherSecret, refresh: 'r2' });
    await expect(getCaller(request({ refresh_token: 'r1' }))).rejects.toBeInstanceOf(AuthConfigError);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it('collapses concurrent refreshes of one cookie into one request', async () => {
    const fetchMock = strapiRefresh({ status: 200, access: await signToken(), refresh: 'r2' });
    await Promise.all([
      getCaller(request({ refresh_token: 'shared' })),
      getCaller(request({ refresh_token: 'shared' })),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives the refresh request a timeout, so a hung Strapi cannot hang every request', async () => {
    const fetchMock = strapiRefresh({ status: 200, access: await signToken(), refresh: 'r2' });
    await getCaller(request({ refresh_token: 'r1' }));
    expect((fetchMock.mock.calls[0] as any)[1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('getAccessTokenServer', () => {
  it('returns a verified cookie, and null for a forged or stale one — it never refreshes', async () => {
    const fetchMock = strapiRefresh({ status: 500 });
    const good = await signToken();
    jar.get.mockReturnValue({ value: good });
    expect(await getAccessTokenServer()).toBe(good);
    jar.get.mockReturnValue({ value: unsignedToken() });
    expect(await getAccessTokenServer()).toBeNull();
    jar.get.mockReturnValue({ value: await signToken({ expiresIn: 30 }) });
    expect(await getAccessTokenServer()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('issuedTokenVerifies', () => {
  it('is true for a token signed with this server’s secret', async () => {
    expect(await issuedTokenVerifies(await signToken())).toBe(true);
  });

  it('is false, and says why, when the secrets differ or ours is unset', async () => {
    expect(await issuedTokenVerifies(await signToken({ secret: 'the-backends-different-secret-0123' }))).toBe(
      false
    );
    const token = await signToken();
    vi.stubEnv('JWT_SECRET', '');
    expect(await issuedTokenVerifies(token)).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });
});
