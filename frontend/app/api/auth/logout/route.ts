import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  getAccessToken,
  revokeSession,
} from '@/app/lib/strapiAuth';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });

  if (req.cookies.get(REFRESH_COOKIE)?.value) {
    // Revoke server-side. Clearing the cookie alone would leave a refresh token
    // valid for a year — anyone holding it stays logged in.
    //
    // getAccessToken may refresh first (Strapi's /auth/logout requires a valid
    // access token), which mints a child session. That is fine because
    // revokeSession uses scope:'all' and kills the whole chain. Revoking only the
    // token we happened to hold would leave its ancestors alive.
    const access = await getAccessToken(req);
    if (access && !(await revokeSession(access))) {
      // Log it, but still clear the cookies: someone who clicked "log out" must
      // never be left logged in on this device.
      console.error('Failed to revoke Strapi session on logout');
    }
  }

  clearAuthCookies(res);
  return res;
}
