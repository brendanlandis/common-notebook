// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// strapiAuth imports next/headers; the gate never calls it, but the import must resolve.
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config, proxy } from './proxy';
import { signToken, unsignedToken } from './app/lib/testTokens';

const request = (path: string, cookies: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    },
  });

/** Strapi's /api/auth/refresh, answering with a fresh pair, a status, or a network error. */
function strapiRefresh(answer: { status: number; access?: string; refresh?: string } | Error) {
  const fetchMock = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify({ jwt: answer.access, refreshToken: answer.refresh }), {
      status: answer.status,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const passesThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';
const sentToLogin = (res: Response) =>
  res.status === 307 && new URL(res.headers.get('location')!).pathname === '/login';
const setCookies = (res: Response) => res.headers.getSetCookie();
const clearsBoth = (res: Response) =>
  ['auth_token', 'refresh_token'].every((name) =>
    setCookies(res).some((c) => c.startsWith(`${name}=;`) && /Max-Age=0/i.test(c))
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('which paths the gate runs on', () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it.each(['/', '/login', '/view/everything', '/api/tasks', '/view/x.png/y'])('runs on %s', (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each(['/icon.png', '/site.webmanifest', '/_next/static/chunks/a.js', '/robots.txt', '/fonts/a.woff2'])(
    'skips the static file %s',
    (url) => {
      expect(matches(url)).toBe(false);
    }
  );
});

describe('the page gate', () => {
  it('lets the public pages through without a session', async () => {
    const fetchMock = strapiRefresh({ status: 500 });
    for (const path of ['/login', '/register', '/forgot-password', '/reset-password']) {
      expect(passesThrough(await proxy(request(path))), path).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves API routes to authenticate themselves', async () => {
    expect(passesThrough(await proxy(request('/api/tasks')))).toBe(true);
  });

  it('sends a visitor with no cookies to /login', async () => {
    const res = await proxy(request('/view/everything'));
    expect(sentToLogin(res)).toBe(true);
    expect(clearsBoth(res)).toBe(true);
  });

  it('renders for a verified access token without asking Strapi', async () => {
    const fetchMock = strapiRefresh({ status: 500 });
    const res = await proxy(request('/view/everything', { auth_token: await signToken(), refresh_token: 'r1' }));
    expect(passesThrough(res)).toBe(true);
    expect(setCookies(res)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a forged access cookie to /login', async () => {
    const res = await proxy(request('/view/everything', { auth_token: unsignedToken() }));
    expect(sentToLogin(res)).toBe(true);
    expect(clearsBoth(res)).toBe(true);
  });

  it('renews an expired session, handing the new cookies to the browser and to this render', async () => {
    const fresh = await signToken({ userId: '4' });
    strapiRefresh({ status: 200, access: fresh, refresh: 'r2' });
    const res = await proxy(
      request('/view/everything', { auth_token: await signToken({ expiresIn: -60 }), refresh_token: 'r1' })
    );
    expect(passesThrough(res)).toBe(true);
    expect(setCookies(res).some((c) => c.startsWith(`auth_token=${fresh};`))).toBe(true);
    expect(setCookies(res).some((c) => c.startsWith('refresh_token=r2;'))).toBe(true);
    // The downstream request's own cookie header carries the new pair.
    expect(res.headers.get('x-middleware-request-cookie')).toContain(`auth_token=${fresh}`);
    expect(res.headers.get('x-middleware-request-cookie')).toContain('refresh_token=r2');
  });

  it('sends a session Strapi refuses to renew to /login, clearing both cookies', async () => {
    strapiRefresh({ status: 401 });
    const res = await proxy(request('/view/everything', { refresh_token: 'revoked' }));
    expect(sentToLogin(res)).toBe(true);
    expect(clearsBoth(res)).toBe(true);
  });

  it('answers 503, keeping the cookies, when Strapi cannot be reached to renew', async () => {
    strapiRefresh(new Error('The operation was aborted due to timeout'));
    const res = await proxy(request('/view/everything', { refresh_token: 'r1' }));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(setCookies(res)).toEqual([]);
  });

  it('answers 500, not a redirect, when JWT_SECRET is unset', async () => {
    const token = await signToken();
    vi.stubEnv('JWT_SECRET', '');
    const res = await proxy(request('/view/everything', { auth_token: token }));
    expect(res.status).toBe(500);
    expect(res.headers.get('location')).toBeNull();
    expect(setCookies(res)).toEqual([]);
  });

  it('answers 500 when the token Strapi just issued fails verification — mismatched secrets', async () => {
    strapiRefresh({ status: 200, access: await signToken({ secret: 'the-backends-different-secret-0123' }), refresh: 'r2' });
    const res = await proxy(request('/view/everything', { refresh_token: 'r1' }));
    expect(res.status).toBe(500);
    expect(setCookies(res)).toEqual([]);
  });

  it('stays out of the way under the local dev bypass', async () => {
    vi.stubEnv('DEV_AUTH_BYPASS', 'true');
    vi.stubEnv('STRAPI_API_URL', 'http://localhost:1337');
    expect(passesThrough(await proxy(request('/view/everything')))).toBe(true);
  });
});
