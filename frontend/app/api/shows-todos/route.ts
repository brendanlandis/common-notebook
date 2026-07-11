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
 *
 * Slownames is now locking down its public API (multi-tenancy beta), so the shows
 * are fetched here server-side through the token-scoped archive — the archive key
 * must never reach the browser. The shows are returned ONLY when `enabled`, so a
 * non-enabled user can never pull Brendan's show history. Pass `?before=YYYY-MM-DD`
 * (the caller's EST date) to include shows on or before that date.
 */
export async function GET(req: NextRequest) {
  const token = await getAccessToken(req);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = process.env.SHOW_TODOS_USER_ID;
  const userId = getUserIdFromAccessToken(token);
  const enabled = Boolean(allowed) && userId !== null && userId === allowed;

  const before = req.nextUrl.searchParams.get('before');
  let shows: unknown[] = [];
  if (enabled && before) {
    shows = await fetchArchiveShows(before);
  }

  return NextResponse.json({ success: true, enabled, shows });
}

/**
 * Past shows for the configured band user, via the slownames archive. Filters
 * shows by their band's member username (band → users → username), tenant-scoped
 * to the archive key's collective and published-only by the archive itself.
 */
async function fetchArchiveShows(before: string): Promise<unknown[]> {
  const base = process.env.NEXT_PUBLIC_STRAPI_BAND_API_URL;
  const key = process.env.BANDNOTEBOOK_KEY;
  const username = process.env.NEXT_PUBLIC_BAND_NOTEBOOK_USER;
  if (!base || !key || !username) return [];

  const params = new URLSearchParams();
  params.append('sort', 'date:desc');
  params.append('pagination[pageSize]', '100');
  params.append('filters[date][$lte]', before);
  params.append('filters[band][users][username][$eq]', username);

  try {
    const res = await fetch(`${base}/api/archive/shows?${params.toString()}`, {
      headers: { 'X-Archive-Key': key },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
}
