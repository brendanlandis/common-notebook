import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';

export const dynamic = 'force-dynamic';

/**
 * Lightweight session liveness check for the on-load SessionGuard.
 *
 * `getAccessToken` returns null when the backend has rejected the refresh token
 * (revoked/expired/foreign) — and, as of the session-limbo fix, clears the dead
 * cookies on that same response. So a 401 here both tells the client "you are
 * signed out" and leaves the browser with no stale cookie for `proxy.ts` to
 * trust on the redirect to /login. No upstream data is fetched.
 *
 * Under DEV_AUTH_BYPASS, getAccessToken returns a minted dev token, so this
 * always reports ok — the guard is a no-op in local bypass dev.
 */
export async function GET(req: NextRequest) {
  const token = await getAccessToken(req);
  return NextResponse.json({ ok: Boolean(token) }, { status: token ? 200 : 401 });
}
