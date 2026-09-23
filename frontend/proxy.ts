import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthConfigError } from './app/lib/authErrors';
import {
  CSP_HEADER,
  CSP_REPORT_PATH,
  contentSecurityPolicy,
  newNonce,
} from './app/lib/contentSecurityPolicy';
import { devAuthBypassEnabled } from './app/lib/devAuth';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  resolveSession,
  setAuthCookies,
} from './app/lib/strapiAuth';

/**
 * Gate page navigations on a verified, live session.
 *
 * A page renders only when the access cookie's signature and expiry check out
 * against `JWT_SECRET` (the backend's), which costs no network call — or, when
 * it doesn't, once Strapi has renewed the session from the refresh cookie. A
 * cookie that is forged, stale, or for a session Strapi has dropped gets
 * /login, with both cookies cleared. Until 2026-09-23 this only decoded the
 * refresh cookie's `exp`, so any cookie that merely looked unexpired got the
 * app shell.
 *
 * Every piece of data is still authorized by Strapi and scoped by the ownership
 * middleware; this decides whether there is a signed-in user to render for.
 *
 *  - No Strapi call while the access token is good. It's renewed at most once
 *    per browser per 30 minutes, the same call the first API request used to
 *    make. A logout elsewhere reaches this browser when its access token next
 *    needs renewing, within 30 minutes.
 *  - A renewal's new cookies go to the browser *and* down to this request, so
 *    the layout's `getAccessTokenServer()` sees them.
 *  - Neither failure below is a logout, so neither clears cookies: 503 when
 *    Strapi can't be reached to renew, 500 when this server can't verify tokens
 *    (`JWT_SECRET` unset or not the backend's). A redirect there would loop.
 *
 * This runs with its own copy of `strapiAuth`; see the concurrency note there.
 *
 * Two more jobs ride along, both reading headers only: an API write must come
 * from this app's own pages (`refuseCrossSiteWrite`), and a page renders with a
 * fresh script nonce and the policy built around it (`render`).
 */

/**
 * Reachable without a session. Forget one of these and the symptom is a redirect
 * loop from an emailed password-reset link.
 */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const UNAVAILABLE_PAGE = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="5">
<title>Can’t check your sign-in</title>
<p>Can’t reach the server to check your sign-in. Trying again in a few seconds…</p>`;

/** Methods that change nothing, so any site's page may send them. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Refuse an API write that another site's page sent, riding this browser's
 * cookies (CSRF). SameSite=Lax keeps the cookies off most of those already;
 * this check doesn't depend on cookie rules, or on which sites share the domain.
 *
 * Browsers say where a request came from. Every current one sends
 * `Sec-Fetch-Site`, and older ones send `Origin` on a write. A request with
 * neither isn't from a web page, so it has no one's cookies to ride. These are
 * the rules of Go's `http.CrossOriginProtection`.
 *
 * A body that declares a type must be JSON. An HTML form can't send JSON, so no
 * form can write here, even from a browser too old to send either header.
 */
function refuseCrossSiteWrite(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) return null;
  // Violation reports come in the browser's own content type, and only get logged.
  if (request.nextUrl.pathname === CSP_REPORT_PATH) return null;

  const sender = crossSiteSender(request);
  if (sender) return refuse(request, 403, 'Cross-site request refused', sender);

  const type = request.headers.get('content-type');
  const mediaType = type?.split(';')[0].trim().toLowerCase();
  if (mediaType !== undefined && mediaType !== 'application/json') {
    return refuse(request, 415, 'Send JSON', `Content-Type: ${type}`);
  }
  return null;
}

/** The header that marks a request as another site's, or null when it isn't. */
function crossSiteSender(request: NextRequest): string | null {
  const site = request.headers.get('sec-fetch-site');
  if (site !== null) {
    // `none` is the person themselves: the address bar, a bookmark.
    return site === 'same-origin' || site === 'none' ? null : `Sec-Fetch-Site: ${site}`;
  }

  const origin = request.headers.get('origin');
  if (origin === null) return null;
  // The host the browser asked for. Next's own server-action check reads the
  // same two headers, since a proxy in front may put it in either.
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
    ?.split(',')[0]
    .trim();
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // `null`, sent by a sandboxed frame or a cross-site redirect.
  }
  return originHost !== null && originHost === host ? null : `Origin: ${origin}`;
}

function refuse(request: NextRequest, status: number, error: string, why: string) {
  console.warn(`[csrf] refused ${request.method} ${request.nextUrl.pathname}: ${why}`);
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Let the page render, with a nonce for its scripts and the policy that allows
 * only those. Next reads the policy off the request and puts its nonce on the
 * scripts it writes; the root layout reads `x-nonce` for the theme script.
 * Anything set on `request` before this (a renewal's cookies) reaches the render
 * too, since `next()` snapshots the headers.
 */
function render(request: NextRequest) {
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === 'development' });
  request.headers.set('x-nonce', nonce);
  request.headers.set(CSP_HEADER, policy);
  const res = NextResponse.next({ request: { headers: request.headers } });
  res.headers.set(CSP_HEADER, policy);
  return res;
}

function redirectToLogin(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', request.url));
  clearAuthCookies(res);
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes authenticate themselves, and refresh on their own. What they
  // can't tell is which site's page sent a write. Checked under the dev bypass
  // too, which would otherwise let any site write as the dev user.
  if (pathname.startsWith('/api/')) {
    return refuseCrossSiteWrite(request) ?? NextResponse.next();
  }

  // Local dev bypass: never gate navigation on a session. Data calls still go
  // through app/api/*, which authenticate as the dev user (see devAuth.ts).
  // Cannot activate on production.
  if (devAuthBypassEnabled()) {
    return render(request);
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return render(request);
  }

  let session;
  try {
    session = await resolveSession(
      request.cookies.get(ACCESS_COOKIE)?.value ?? null,
      request.cookies.get(REFRESH_COOKIE)?.value ?? null
    );
  } catch (err) {
    if (!(err instanceof AuthConfigError)) throw err;
    console.error('[auth]', err.message);
    return new NextResponse('Sign-in is misconfigured on the server.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  switch (session.kind) {
    case 'valid':
      return render(request);
    case 'refreshed': {
      // Set on the request before `render`, so the layout sees them too.
      request.cookies.set(ACCESS_COOKIE, session.tokens.access);
      request.cookies.set(REFRESH_COOKIE, session.tokens.refresh);
      const res = render(request);
      setAuthCookies(res, session.tokens);
      return res;
    }
    case 'unavailable':
      return new NextResponse(UNAVAILABLE_PAGE, {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': '5',
          'Cache-Control': 'no-store',
        },
      });
    case 'none':
    case 'rejected':
      return redirectToLogin(request);
  }
}

export const config = {
  // Exclude Next.js internals and static files from /public. Each extension is
  // anchored to the end of the path; unanchored, `/view/x.png/y` skipped the gate.
  matcher: [
    '/((?!_next/static|_next/image|robots\\.txt$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.webmanifest$|.*\\.woff$|.*\\.woff2$|.*\\.ttf$|.*\\.otf$).*)',
  ],
};
