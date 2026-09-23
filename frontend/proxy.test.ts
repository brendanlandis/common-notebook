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

/** A request as a browser (or a script) sends it: nginx passes the Host on. */
const write = (path: string, headers: Record<string, string> = {}, method = 'POST') =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { host: 'commonnotebook.com', ...headers },
  });

/** What this app's own pages send with a write. */
const OWN_PAGE = { 'sec-fetch-site': 'same-origin', origin: 'https://commonnotebook.com' };
const JSON_BODY = { 'content-type': 'application/json' };

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

const policyOf = (res: Response) => res.headers.get('content-security-policy-report-only');
/** The nonce the page render sees, and the one the policy sent to the browser allows. */
const nonces = (res: Response) => ({
  render: res.headers.get('x-middleware-request-x-nonce'),
  policy: policyOf(res)?.match(/'nonce-([^']+)'/)?.[1],
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
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

describe('writes to the API', () => {
  const refused = (res: Response) => res.status === 403;

  it("lets this app's own pages write", async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = await proxy(write('/api/tasks', { ...OWN_PAGE, ...JSON_BODY }, method));
      expect(passesThrough(res), method).toBe(true);
    }
  });

  it("refuses a write another site's page sent", async () => {
    const res = await proxy(
      write('/api/tasks', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example', ...JSON_BODY })
    );
    expect(refused(res)).toBe(true);
    expect(await res.json()).toEqual({ success: false, error: 'Cross-site request refused' });
    expect(console.warn).toHaveBeenCalledWith(
      '[csrf] refused POST /api/tasks: Sec-Fetch-Site: cross-site'
    );
  });

  it('refuses a write from a sibling site under the same domain', async () => {
    const res = await proxy(
      write('/api/tasks', { 'sec-fetch-site': 'same-site', origin: 'https://api.commonnotebook.com' })
    );
    expect(refused(res)).toBe(true);
  });

  it('lets a write the person made themselves through', async () => {
    expect(passesThrough(await proxy(write('/api/auth/logout', { 'sec-fetch-site': 'none' })))).toBe(true);
  });

  it('lets reads through from anywhere', async () => {
    const res = await proxy(write('/api/tasks', { 'sec-fetch-site': 'cross-site' }, 'GET'));
    expect(passesThrough(res)).toBe(true);
  });

  it('falls back on Origin for a browser too old to send Sec-Fetch-Site', async () => {
    expect(passesThrough(await proxy(write('/api/tasks', { origin: 'https://commonnotebook.com' })))).toBe(true);
    expect(refused(await proxy(write('/api/tasks', { origin: 'https://evil.example' })))).toBe(true);
    expect(refused(await proxy(write('/api/tasks', { origin: 'null' })))).toBe(true);
  });

  it('matches Origin against the host a proxy in front forwarded', async () => {
    const res = await proxy(
      write('/api/tasks', {
        host: '127.0.0.1:3000',
        'x-forwarded-host': 'commonnotebook.com',
        origin: 'https://commonnotebook.com',
      })
    );
    expect(passesThrough(res)).toBe(true);
  });

  it('lets through a request from no web page at all', async () => {
    expect(passesThrough(await proxy(write('/api/tasks', JSON_BODY)))).toBe(true);
  });

  it("refuses a body only a form would send, even from this app's pages", async () => {
    for (const type of ['text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      const res = await proxy(write('/api/tasks', { ...OWN_PAGE, 'content-type': type }));
      expect(res.status, type).toBe(415);
    }
  });

  it('takes JSON with a charset', async () => {
    const res = await proxy(write('/api/tasks', { ...OWN_PAGE, 'content-type': 'application/json; charset=utf-8' }));
    expect(passesThrough(res)).toBe(true);
  });

  it("takes a violation report in the browser's own content type", async () => {
    const res = await proxy(write('/api/csp-report', { ...OWN_PAGE, 'content-type': 'application/csp-report' }));
    expect(passesThrough(res)).toBe(true);
  });

  it('checks under the local dev bypass too', async () => {
    vi.stubEnv('DEV_AUTH_BYPASS', 'true');
    vi.stubEnv('STRAPI_API_URL', 'http://localhost:1337');
    expect(refused(await proxy(write('/api/tasks', { 'sec-fetch-site': 'cross-site' })))).toBe(true);
  });
});

describe('the page policy', () => {
  it('sends a report-only policy allowing only the nonce this render puts on its scripts', async () => {
    const res = await proxy(request('/view/everything', { auth_token: await signToken() }));
    const { render, policy } = nonces(res);
    expect(render).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(policy).toBe(render);
    expect(policyOf(res)).toContain("'strict-dynamic'");
    // Next reads the policy off the request to find the nonce for its own scripts.
    expect(res.headers.get('x-middleware-request-content-security-policy-report-only')).toBe(policyOf(res));
  });

  it('never reuses a nonce', async () => {
    const token = await signToken();
    const a = nonces(await proxy(request('/view/everything', { auth_token: token })));
    const b = nonces(await proxy(request('/view/everything', { auth_token: token })));
    expect(a.render).not.toBe(b.render);
  });

  it('covers a renewed session, the public pages and the dev bypass', async () => {
    strapiRefresh({ status: 200, access: await signToken(), refresh: 'r2' });
    const renewed = await proxy(request('/view/everything', { refresh_token: 'r1' }));
    expect(nonces(renewed).policy).toBe(nonces(renewed).render);
    expect(policyOf(await proxy(request('/login')))).not.toBeNull();

    vi.stubEnv('DEV_AUTH_BYPASS', 'true');
    vi.stubEnv('STRAPI_API_URL', 'http://localhost:1337');
    expect(policyOf(await proxy(request('/view/everything')))).not.toBeNull();
  });

  it('leaves API responses and redirects without one', async () => {
    expect(policyOf(await proxy(request('/api/tasks')))).toBeNull();
    expect(policyOf(await proxy(request('/view/everything')))).toBeNull();
  });

  it('allows eval only in development, where React uses it', async () => {
    const token = await signToken();
    expect(policyOf(await proxy(request('/', { auth_token: token })))).not.toContain('unsafe-eval');
    vi.stubEnv('NODE_ENV', 'development');
    expect(policyOf(await proxy(request('/', { auth_token: token })))).toContain("'unsafe-eval'");
  });
});
