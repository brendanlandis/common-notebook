import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side token handling for the Strapi session/refresh flow.
 *
 * Strapi runs in `jwtManagement: 'refresh'` mode: `/auth/local` returns a short
 * access token (30 min) plus a long-lived refresh token backed by a row in
 * `strapi_sessions`. Only the session row can be revoked — `validateAccessToken`
 * is a stateless `jwt.verify` — so the access token must stay short for
 * `/auth/logout` to mean anything.
 *
 * The browser never sees either token. Both live in httpOnly cookies that only
 * this server reads.
 *
 * We refresh *proactively*, based on the access token's `exp`, rather than
 * reactively on a 401. That keeps every route handler a one-liner and avoids
 * retry plumbing.
 *
 * Concurrency is safe without a lock. Strapi's `rotateRefreshToken` is
 * idempotent: "if parent already has a child, return the same child token"
 * (@strapi/core session-manager). Verified — five simultaneous refreshes with
 * the same token return the identical child. The in-flight map below is purely
 * an optimisation to collapse N parallel HTTP calls into one.
 */

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export const ACCESS_COOKIE = 'auth_token';
export const REFRESH_COOKIE = 'refresh_token';

/** Refresh this many seconds before the access token actually expires. */
const EXPIRY_SKEW_SECONDS = 60;

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // The cookie outlives the access token on purpose: the *token* expires and we
  // silently refresh it. A short cookie would log the user out instead.
  maxAge: YEAR_SECONDS,
};

export interface Tokens {
  access: string;
  refresh: string;
}

/**
 * Read a JWT's `exp` without verifying it. Used only to decide *when* to
 * refresh — never to authorize. Strapi verifies every token it is given.
 */
function readExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/**
 * True if the token expires within the skew window. An unparseable token returns
 * false: we let Strapi be the judge rather than guessing. (Tests pass opaque
 * strings like `test-token`; they must not trigger a refresh.)
 */
export function isExpiringSoon(token: string, now = Date.now()): boolean {
  const exp = readExpiry(token);
  if (exp === null) return false;
  return exp - EXPIRY_SKEW_SECONDS <= Math.floor(now / 1000);
}

/** Collapse simultaneous refreshes of the same token into one request. */
const inFlight = new Map<string, Promise<Tokens | null>>();

async function requestRefresh(refreshToken: string): Promise<Tokens | null> {
  const response = await fetch(`${STRAPI_API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) return null; // expired, or the session was revoked by logout

  const data = await response.json();
  if (!data?.jwt || !data?.refreshToken) return null;
  return { access: data.jwt, refresh: data.refreshToken };
}

export async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;

  const pending = requestRefresh(refreshToken).finally(() => inFlight.delete(refreshToken));
  inFlight.set(refreshToken, pending);
  return pending;
}

/**
 * Write tokens to the outgoing response. Best-effort: `cookies()` throws outside
 * a request scope (unit tests), and a failure here only costs an extra refresh
 * on the next request.
 */
async function persistTokens(tokens: Tokens): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(ACCESS_COOKIE, tokens.access, COOKIE_OPTIONS);
    jar.set(REFRESH_COOKIE, tokens.refresh, COOKIE_OPTIONS);
  } catch {
    /* not in a request scope */
  }
}

/**
 * The access token to send to Strapi, refreshing it first if it is about to
 * expire. Returns null when the caller is not authenticated.
 *
 * Replaces `req.cookies.get('auth_token')?.value` in every route handler.
 */
export async function getAccessToken(req: NextRequest): Promise<string | null> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value ?? null;

  if (access && !isExpiringSoon(access)) return access;
  if (!refresh) return access; // pre-session cookie, or logged out

  const tokens = await refreshTokens(refresh);
  if (!tokens) return null; // session revoked or refresh token expired

  await persistTokens(tokens);
  return tokens.access;
}

/** Set both cookies on a response. Used by the login and redemption routes. */
export function setAuthCookies(res: NextResponse, tokens: Tokens): void {
  res.cookies.set(ACCESS_COOKIE, tokens.access, COOKIE_OPTIONS);
  res.cookies.set(REFRESH_COOKIE, tokens.refresh, COOKIE_OPTIONS);
}

export function clearAuthCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    res.cookies.set(name, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  }
}

/**
 * Revoke every session for the user. Without this, logging out merely deletes the
 * cookie while the refresh token stays valid for a year.
 *
 * `scope: 'all'` is deliberate, not laziness. Strapi's default logout revokes
 * only the session named by the current token. But rotation builds a *chain* —
 * each refresh mints a child session — and ancestors stay valid until their own
 * expiry, a year out. Rotation is also idempotent, so replaying any ancestor
 * token rotates straight back into the live child. Revoking one link therefore
 * revokes nothing in practice: whoever holds an older refresh token keeps access.
 *
 * The cost is that logging out on one device logs you out everywhere. That is the
 * right trade for a beta, and per-device sign-out is available later via the
 * `deviceId` scope and `GET /api/auth/sessions`.
 */
export async function revokeSession(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${STRAPI_API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ scope: 'all' }),
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
