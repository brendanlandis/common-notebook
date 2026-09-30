import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages } from '@/app/lib/strapiServer';
import { errorResponse } from '@/app/lib/errorResponse';

/**
 * Practice sessions — the sittings — newest first, each with its subject.
 *
 * History reads these for the whole-session notes; the minutes come from the
 * logs, which already carry their piece and subject. `?since=YYYY-MM-DD` keeps
 * it to the window history shows.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const since = new URL(req.url).searchParams.get('since');
    let query = '?sort[0]=date:desc&populate[subject][fields][0]=title';
    if (since && /^\d{4}-\d{2}-\d{2}$/.test(since)) {
      query += `&filters[date][$gte]=${since}`;
    }

    const sessions = await fetchAllPages(token, `/api/practice-sessions${query}`);
    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    return errorResponse('Error fetching practice sessions:', error);
  }
}
