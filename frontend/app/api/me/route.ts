import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

/**
 * The current user's own beta-access flag.
 *
 * `betaAccess` is a boolean on the Strapi User record; it gates pages that are
 * still "in beta" (see `app/lib/betaConfig.ts`). The check lives here rather than
 * in the browser because the client has no trustworthy notion of who it is — the
 * token identifying the caller is httpOnly and only this server sends it to
 * Strapi, which verifies it.
 *
 * Fails closed: a missing/expired session, any Strapi error, or an absent field
 * all yield `betaAccess: false`, so a beta page stays hidden unless Strapi
 * affirmatively says the caller may see it.
 *
 * This is the natural home for future current-user fields (username, id).
 */
export async function GET(req: NextRequest) {
  const token = await getAccessToken(req);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let betaAccess = false;
  try {
    const response = await fetch(`${STRAPI_API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (response.ok) {
      const user = await response.json();
      betaAccess = Boolean(user?.betaAccess);
    }
  } catch {
    // fail closed — leave betaAccess false
  }

  return NextResponse.json({ success: true, betaAccess });
}
