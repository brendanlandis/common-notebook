import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { devAuthBypassEnabled, getDevCredentials } from './devAuth';

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
 * Decode a JWT payload without verifying the signature. Used only for local
 * bookkeeping — when to refresh, and which in-process mutex to take. Never to
 * authorize: Strapi verifies every token it is given.
 */
function readPayload(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function readExpiry(token: string): number | null {
  const exp = readPayload(token)?.exp;
  return typeof exp === 'number' ? exp : null;
}

/**
 * The user id carried by an access token, for keying per-user in-process work
 * (see `runMoonPhaseResetIfDue`). Falls back to null for opaque tokens.
 */
export function getUserIdFromAccessToken(token: string): string | null {
  const userId = readPayload(token)?.userId;
  return userId === undefined || userId === null ? null : String(userId);
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
 * Local dev bypass: an in-process session for the configured dev user, minted
 * via /auth/local and kept fresh with the same machinery as a real session
 * (never written to cookies). Reached only when `devAuthBypassEnabled()` is
 * true, which cannot happen on production — see devAuth.ts.
 */
let devTokens: Tokens | null = null;
let devMintInFlight: Promise<Tokens | null> | null = null;

async function mintDevTokens(): Promise<Tokens | null> {
  const { identifier, password } = getDevCredentials();
  try {
    const response = await fetch(`${STRAPI_API_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn(
        `[dev-auth] Could not log in as "${identifier}" (HTTP ${response.status}). ` +
          `Is the local backend running and seeded? Try: cd backend && node scripts/seed-dev.js`
      );
      return null;
    }
    const data = await response.json();
    if (!data?.jwt || !data?.refreshToken) return null;
    return { access: data.jwt, refresh: data.refreshToken };
  } catch (err) {
    console.warn('[dev-auth] Failed to reach local Strapi for dev login:', err);
    return null;
  }
}

async function getDevAccessToken(): Promise<string | null> {
  if (devTokens && !isExpiringSoon(devTokens.access)) return devTokens.access;

  if (devTokens?.refresh) {
    const refreshed = await refreshTokens(devTokens.refresh);
    if (refreshed) {
      devTokens = refreshed;
      return devTokens.access;
    }
  }

  // Collapse concurrent mints into a single /auth/local call.
  if (!devMintInFlight) {
    devMintInFlight = mintDevTokens().finally(() => {
      devMintInFlight = null;
    });
  }
  devTokens = await devMintInFlight;
  return devTokens?.access ?? null;
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
 * Delete both session cookies on the outgoing response. Called when Strapi
 * rejects the refresh token: the cookie is authoritatively dead, so we stop
 * trusting it — otherwise `proxy.ts` keeps rendering the app shell for a session
 * the backend has already dropped. Mirrors `persistTokens`' best-effort jar use
 * (no NextResponse is available here).
 */
async function clearSessionCookieJar(): Promise<void> {
  try {
    const jar = await cookies();
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      jar.set(name, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    }
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
  // Local dev: impersonate the configured dev user, ignoring cookies entirely.
  // Gated so it can never activate on production (see devAuth.ts).
  if (devAuthBypassEnabled()) return getDevAccessToken();

  const access = req.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value ?? null;

  if (access && !isExpiringSoon(access)) return access;
  if (!refresh) return access; // pre-session cookie, or logged out

  const tokens = await refreshTokens(refresh);
  if (!tokens) {
    // Session revoked or refresh token expired/foreign — clear the dead cookies
    // so the page gate stops treating the caller as logged in.
    await clearSessionCookieJar();
    return null;
  }

  await persistTokens(tokens);
  return tokens.access;
}

/**
 * The access token, for callers that have no `NextRequest` — i.e. Server
 * Components, which read cookies from the request scope rather than a `req`.
 *
 * Deliberately does **not** refresh, which is the whole difference from
 * `getAccessToken()`. A Server Component cannot write cookies (`persistTokens`
 * silently no-ops there), so refreshing would rotate the session, fail to hand
 * the browser its new tokens, and mint an orphan `strapi_sessions` row on every
 * render. Instead a stale token returns null and the caller falls back to the
 * client path, where `/api/me` refreshes properly through a route handler.
 *
 * So: null means "cannot tell from here", not "logged out".
 */
export async function getAccessTokenServer(): Promise<string | null> {
  // Local dev: mints/refreshes its own tokens in-process, no cookies involved.
  if (devAuthBypassEnabled()) return getDevAccessToken();

  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value ?? null;
  return access && !isExpiringSoon(access) ? access : null;
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
