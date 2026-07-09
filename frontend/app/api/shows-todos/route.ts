import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getUserIdFromAccessToken } from '@/app/lib/strapiAuth';

/**
 * Is the caller allowed to auto-create todos from slownames band shows?
 *
 * `createTodosFromShows()` fetches shows for a *hardcoded* slownames username and
 * writes the resulting todos into whoever is logged in. Before ownership existed
 * there was only one account, so that was the same person. It no longer is: every
 * invited beta user would silently receive Brendan's band chores, and with them
 * his show history — band, venue, date.
 *
 * So the feature is gated on identity, and the check lives here rather than in the
 * browser because the client has no trustworthy notion of who it is. The user id
 * comes from the access token, which Strapi signed.
 *
 * Fails closed: with SHOW_TODOS_USER_ID unset, nobody gets show todos. That is the
 * right default for every deployment except the one where Brendan set it.
 *
 * This is a stopgap. The real fix is a per-user "slownames username" setting, which
 * lands when slownames grows its own tenancy — see MULTI-TENANCY-PLAN.md.
 */
export async function GET(req: NextRequest) {
  const token = await getAccessToken(req);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = process.env.SHOW_TODOS_USER_ID;
  const userId = getUserIdFromAccessToken(token);

  return NextResponse.json({
    success: true,
    enabled: Boolean(allowed) && userId !== null && userId === allowed,
  });
}
