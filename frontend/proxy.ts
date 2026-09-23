import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthConfigError } from './app/lib/authErrors';
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

function redirectToLogin(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', request.url));
  clearAuthCookies(res);
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Local dev bypass: never gate navigation on a session. Data calls still go
  // through app/api/*, which authenticate as the dev user (see devAuth.ts).
  // Cannot activate on production.
  if (devAuthBypassEnabled()) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // API routes authenticate themselves, and refresh on their own.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
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
      return NextResponse.next();
    case 'refreshed': {
      // Set on the request before `next()`, which snapshots its headers.
      request.cookies.set(ACCESS_COOKIE, session.tokens.access);
      request.cookies.set(REFRESH_COOKIE, session.tokens.refresh);
      const res = NextResponse.next({ request: { headers: request.headers } });
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
