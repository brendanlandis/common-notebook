import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { errors as joseErrors, jwtVerify } from 'jose';
import { AuthConfigError, SessionUnavailableError } from './authErrors';
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
 * **Nothing here trusts a cookie it hasn't verified.** Strapi signs both tokens
 * with HS256 and `JWT_SECRET`, and this server holds the same secret, so it
 * checks the access token's signature and expiry itself: no Strapi call while
 * it's good. Otherwise Strapi is asked to refresh, which checks the session row;
 * a refusal means the session is over and the cookies are cleared. A token
 * Strapi has *just issued* that fails verification means the two secrets differ,
 * which is an `AuthConfigError` (a loud 500), never a logout.
 *
 * We refresh *proactively*, based on the access token's `exp`, rather than
 * reactively on a 401. That keeps every route handler a one-liner and avoids
 * retry plumbing.
 *
 * Concurrency is safe without a lock. Strapi's `rotateRefreshToken` is
 * idempotent: "if parent already has a child, return the same child token"
 * (@strapi/core session-manager). Verified — five simultaneous refreshes with
 * the same token return the identical child. The in-flight map below is purely
 * an optimisation to collapse N parallel HTTP calls into one. `proxy.ts` gets
 * its own copy of this module, so a page load and its API calls can each
 * refresh the same cookie; that's the same idempotent case.
 */

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export const ACCESS_COOKIE = 'auth_token';
export const REFRESH_COOKIE = 'refresh_token';

/** Refresh this many seconds before the access token actually expires. */
const EXPIRY_SKEW_SECONDS = 60;

/** Past this, a refresh counts as Strapi being unavailable, not as a logout. */
const REFRESH_TIMEOUT_MS = 5_000;

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

/** What a verified access token says. */
export interface AccessClaims {
  userId: string;
  exp: number;
}

/**
 * The key Strapi signs with: the raw bytes of `JWT_SECRET`, which it hands
 * straight to `jsonwebtoken`. Read on every call, never at module load — CI
 * builds with no environment.
 */
function signingKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthConfigError(
      'JWT_SECRET is not set in the frontend. It must be the backend’s JWT_SECRET, or no session can be verified.'
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * The claims of an access token Strapi signed that hasn't expired, or null for
 * anything else: forged, unsigned (`alg: none`), another algorithm, expired, a
 * refresh token, or not a JWT at all. It leans on as little of Strapi's token
 * format as it can — the signature, `exp`, and a `userId` — so an upgrade that
 * changes the rest doesn't break sign-in. Throws `AuthConfigError` when
 * `JWT_SECRET` is unset.
 */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ['HS256'],
      clockTolerance: 5,
      requiredClaims: ['exp'],
    });
    if (payload.type !== undefined && payload.type !== 'access') return null;
    const userId = payload.userId;
    if ((typeof userId !== 'string' && typeof userId !== 'number') || userId === '') return null;
    return { userId: String(userId), exp: payload.exp as number };
  } catch (err) {
    if (err instanceof joseErrors.JOSEError) return null;
    throw err;
  }
}

function expiresWithinSkew(exp: number, now = Date.now()): boolean {
  return exp - EXPIRY_SKEW_SECONDS <= Math.floor(now / 1000);
}

/**
 * Check a token Strapi has just handed us (login, reset, invite) before setting
 * it as a cookie. False means the frontend's `JWT_SECRET` isn't the backend's:
 * a session would be set and then refused on the next request.
 */
export async function issuedTokenVerifies(access: string): Promise<boolean> {
  try {
    if (await verifyAccessToken(access)) return true;
  } catch (err) {
    if (!(err instanceof AuthConfigError)) throw err;
  }
  console.error(
    '[auth] A token Strapi just issued failed verification: JWT_SECRET is unset in the frontend, or differs from the backend’s.'
  );
  return false;
}

type RefreshOutcome =
  | { kind: 'ok'; tokens: Tokens }
  | { kind: 'rejected' } // Strapi said no: the session is over
  | { kind: 'unavailable' }; // couldn't ask: the session is unknown, not over

async function requestRefresh(refreshToken: string): Promise<RefreshOutcome> {
  let response: Response;
  try {
    response = await fetch(`${STRAPI_API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[auth] Could not reach Strapi to refresh a session:', err);
    return { kind: 'unavailable' };
  }

  // 401: expired, revoked, or not Strapi's token. 400: none sent.
  if (response.status === 400 || response.status === 401) return { kind: 'rejected' };
  if (!response.ok) {
    console.error(`[auth] Strapi answered a refresh with ${response.status}.`);
    return { kind: 'unavailable' };
  }

  const data = await response.json().catch(() => null);
  if (!data?.jwt || !data?.refreshToken) {
    console.error('[auth] Strapi answered a refresh without both tokens.');
    return { kind: 'unavailable' };
  }
  return { kind: 'ok', tokens: { access: data.jwt, refresh: data.refreshToken } };
}

type RefreshedSession =
  | { kind: 'refreshed'; tokens: Tokens; claims: AccessClaims }
  | { kind: 'rejected' }
  | { kind: 'unavailable' };

/** Collapse simultaneous refreshes of the same token into one request. */
const inFlight = new Map<string, Promise<RefreshedSession>>();

async function refreshAndVerify(refreshToken: string): Promise<RefreshedSession> {
  const outcome = await requestRefresh(refreshToken);
  if (outcome.kind !== 'ok') return outcome;
  const claims = await verifyAccessToken(outcome.tokens.access);
  if (!claims) {
    throw new AuthConfigError(
      'A token Strapi just issued failed verification: the frontend’s JWT_SECRET differs from the backend’s.'
    );
  }
  return { kind: 'refreshed', tokens: outcome.tokens, claims };
}

function refreshSession(refreshToken: string): Promise<RefreshedSession> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;

  const pending = refreshAndVerify(refreshToken).finally(() => inFlight.delete(refreshToken));
  inFlight.set(refreshToken, pending);
  return pending;
}

export type Session =
  | { kind: 'valid'; token: string; claims: AccessClaims }
  | { kind: 'refreshed'; tokens: Tokens; claims: AccessClaims }
  | { kind: 'none' } // no usable cookie at all
  | { kind: 'rejected' } // Strapi refused the refresh: the session is over
  | { kind: 'unavailable' }; // Strapi couldn't be asked

/**
 * Where the session stands, from the two cookies. Shared by `proxy.ts` and the
 * route handlers. Calls Strapi only when the access token is missing, bad, or
 * about to expire. Throws `AuthConfigError` when tokens can't be verified.
 */
export async function resolveSession(access: string | null, refresh: string | null): Promise<Session> {
  const claims = access ? await verifyAccessToken(access) : null;
  if (claims && access && (!expiresWithinSkew(claims.exp) || !refresh)) {
    return { kind: 'valid', token: access, claims };
  }
  if (!refresh) return { kind: 'none' };

  const refreshed = await refreshSession(refresh);
  // Strapi is out of reach but the access token still has seconds left: use it.
  if (refreshed.kind === 'unavailable' && claims && access) {
    return { kind: 'valid', token: access, claims };
  }
  return refreshed;
}

/**
 * Local dev bypass: an in-process session for the configured dev user, minted
 * via /auth/local and kept fresh with the same machinery as a real session
 * (never written to cookies). Reached only when `devAuthBypassEnabled()` is
 * true, which cannot happen on production — see devAuth.ts.
 *
 * Its tokens come from this process, never from a browser, so they're read
 * without verification and need no `JWT_SECRET`.
 */
let devTokens: Tokens | null = null;
let devUserId: string | null = null;
let devMintInFlight: Promise<Tokens | null> | null = null;

function devTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    return typeof payload?.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

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
    devUserId = data.user?.id === undefined ? null : String(data.user.id);
    return { access: data.jwt, refresh: data.refreshToken };
  } catch (err) {
    console.warn('[dev-auth] Failed to reach local Strapi for dev login:', err);
    return null;
  }
}

async function getDevAccessToken(): Promise<string | null> {
  const exp = devTokens ? devTokenExpiry(devTokens.access) : null;
  if (devTokens && exp !== null && !expiresWithinSkew(exp)) return devTokens.access;

  if (devTokens?.refresh) {
    const refreshed = await requestRefresh(devTokens.refresh);
    if (refreshed.kind === 'ok') {
      devTokens = refreshed.tokens;
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
 * sending it. Mirrors `persistTokens`' best-effort jar use (no NextResponse is
 * available here).
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

/** Who is calling, verified: the token to send to Strapi and the user id it carries. */
export interface Caller {
  token: string;
  userId: string;
}

/**
 * The verified caller, refreshing first if the access token is about to expire,
 * or null when there's no live session (and any dead cookies are cleared).
 * Throws `SessionUnavailableError` when Strapi can't be asked, and
 * `AuthConfigError` when tokens can't be verified.
 *
 * Use this where the handler needs to know *who* is calling; a claim read
 * without verification is not an identity.
 */
export async function getCaller(req: NextRequest): Promise<Caller | null> {
  // Local dev: impersonate the configured dev user, ignoring cookies entirely.
  // Gated so it can never activate on production (see devAuth.ts).
  if (devAuthBypassEnabled()) {
    const token = await getDevAccessToken();
    return token && devUserId ? { token, userId: devUserId } : null;
  }

  const session = await resolveSession(
    req.cookies.get(ACCESS_COOKIE)?.value ?? null,
    req.cookies.get(REFRESH_COOKIE)?.value ?? null
  );
  switch (session.kind) {
    case 'valid':
      return { token: session.token, userId: session.claims.userId };
    case 'refreshed':
      await persistTokens(session.tokens);
      return { token: session.tokens.access, userId: session.claims.userId };
    case 'rejected':
      // The session is over: clear the dead cookies so nothing keeps sending them.
      await clearSessionCookieJar();
      return null;
    case 'unavailable':
      throw new SessionUnavailableError('Strapi could not be reached to refresh the session.');
    case 'none':
      return null;
  }
}

/**
 * The access token to send to Strapi, verified, and refreshed first if it is
 * about to expire. Returns null when the caller is not authenticated.
 *
 * Replaces `req.cookies.get('auth_token')?.value` in every route handler.
 */
export async function getAccessToken(req: NextRequest): Promise<string | null> {
  if (devAuthBypassEnabled()) return getDevAccessToken();
  return (await getCaller(req))?.token ?? null;
}

/**
 * The access token, for callers that have no `NextRequest` — i.e. Server
 * Components, which read cookies from the request scope rather than a `req`.
 *
 * Deliberately does **not** refresh, which is the whole difference from
 * `getAccessToken()`. A Server Component cannot write cookies (`persistTokens`
 * silently no-ops there), so refreshing would rotate the session, fail to hand
 * the browser its new tokens, and mint an orphan `strapi_sessions` row on every
 * render. It doesn't need to: `proxy.ts` has already refreshed for this request
 * and passed the new cookies down. A stale token returns null and the caller
 * falls back to the client path.
 *
 * So: null means "cannot tell from here", not "logged out".
 */
export async function getAccessTokenServer(): Promise<string | null> {
  // Local dev: mints/refreshes its own tokens in-process, no cookies involved.
  if (devAuthBypassEnabled()) return getDevAccessToken();

  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value ?? null;
  if (!access) return null;
  try {
    const claims = await verifyAccessToken(access);
    return claims && !expiresWithinSkew(claims.exp) ? access : null;
  } catch {
    return null; // AuthConfigError: proxy.ts has already answered this request with a 500
  }
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
 * each refresh mints a child session — and a token whose child has been deleted
 * mints a fresh active child when replayed. Revoking one link therefore revokes
 * nothing in practice: whoever holds an older refresh token keeps access.
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
