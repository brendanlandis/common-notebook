import { NextRequest, NextResponse } from 'next/server';
import { AuthConfigError, SessionUnavailableError } from '@/app/lib/authErrors';
import { getAccessToken } from '@/app/lib/strapiAuth';

export const dynamic = 'force-dynamic';

/**
 * Session liveness check for the on-load SessionGuard.
 *
 * 200 means the access token verified (or Strapi just renewed it). 401 means
 * there is no live session: no usable cookie, or Strapi refused the refresh, in
 * which case `getAccessToken` has already cleared the dead cookies on this same
 * response, so the redirect to /login starts clean. No upstream data is fetched,
 * and while the access token is good Strapi isn't asked at all.
 *
 * Neither failure below is a logout, so neither clears cookies, and SessionGuard
 * only acts on the 401: 503 when Strapi can't be reached to renew the session,
 * 500 when this server can't verify tokens at all (`JWT_SECRET`).
 *
 * Under DEV_AUTH_BYPASS, getAccessToken returns a minted dev token, so this
 * always reports ok — the guard is a no-op in local bypass dev.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    return NextResponse.json({ ok: Boolean(token) }, { status: token ? 200 : 401 });
  } catch (err) {
    if (err instanceof SessionUnavailableError) {
      return NextResponse.json(
        { ok: false, error: 'unavailable' },
        { status: 503, headers: { 'Retry-After': '5' } }
      );
    }
    if (err instanceof AuthConfigError) {
      console.error('[auth]', err.message);
      return NextResponse.json({ ok: false, error: 'misconfigured' }, { status: 500 });
    }
    console.error('Error checking the session:', err);
    return NextResponse.json({ ok: false, error: 'error' }, { status: 500 });
  }
}
