import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { devAuthBypassEnabled } from './app/lib/devAuth';

/**
 * Gate page navigations on the presence of a live session.
 *
 * This is a UX gate, not an authorization boundary. It decides whether to render
 * the app shell or bounce to /login. Every piece of data is still fetched through
 * `app/api/*`, which sends a token Strapi verifies and which the ownership
 * middleware scopes to the caller. A forged cookie gets you an empty shell.
 *
 * Two deliberate changes from the original:
 *
 *  - It checks the *refresh* token, not the access token. Access tokens live 30
 *    minutes and are refreshed transparently by `getAccessToken()` inside the
 *    route handlers; gating on one would bounce everybody to /login every half
 *    hour.
 *  - It no longer calls `GET /users/me` on every navigation. That was a Strapi
 *    round-trip per page view, and it coupled every page load to backend
 *    availability. Expiry is now read from the token locally.
 */

const ACCESS_COOKIE = 'auth_token';
const REFRESH_COOKIE = 'refresh_token';

/**
 * Reachable without a session. Forget one of these and the symptom is a redirect
 * loop from an emailed password-reset link.
 */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 0,
};

/**
 * Read a JWT's `exp` without verifying the signature. Safe here precisely because
 * nothing is authorized on the result — see the note above. Written to work in
 * both the Edge and Node runtimes.
 */
function expiresAt(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob === 'function' ? atob(normalized) : Buffer.from(normalized, 'base64').toString();
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', request.url));
  res.cookies.set(ACCESS_COOKIE, '', CLEAR_COOKIE_OPTIONS);
  res.cookies.set(REFRESH_COOKIE, '', CLEAR_COOKIE_OPTIONS);
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

  // API routes authenticate themselves, and are where token refresh happens.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return redirectToLogin(request);
  }

  // A malformed token yields null; treat that as "no session" rather than trust it.
  const exp = expiresAt(refresh);
  if (exp === null || exp <= Math.floor(Date.now() / 1000)) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude: Next.js internals, API routes (handled separately above), and all static files from /public
  matcher: ['/((?!_next/static|_next/image|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.webp|.*\\.webmanifest|.*\\.woff|.*\\.woff2|.*\\.ttf|.*\\.otf|robots\\.txt).*)'],
};
