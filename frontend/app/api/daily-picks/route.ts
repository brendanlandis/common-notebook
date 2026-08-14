import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';

/**
 * The day's narrowed selection: one row per date.
 *
 * Rows are kept rather than overwritten in place, even though the UI only ever
 * reads today's. Behavior is a scratch pad that starts empty each morning, but
 * keeping the history means "how many did I pick versus actually finish" stays
 * answerable later — the other half of that already exists in `completedAt`, the
 * completed-row chain recurring tasks leave behind, and `workSessions`.
 */

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const date = new URL(req.url).searchParams.get('date');
    if (!date) {
      return NextResponse.json(
        { success: false, error: 'date parameter is required' },
        { status: 400 }
      );
    }

    const picks = await fetchAllPages(
      token,
      `/api/daily-picks?filters[date][$eq]=${encodeURIComponent(date)}` +
        '&populate[tasks][populate]=project'
    );

    // At most one row per date. Answering with the row rather than a list keeps
    // the caller from having to know that.
    return NextResponse.json({ success: true, data: picks[0] ?? null });
  } catch (error) {
    console.error('Error fetching daily pick:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Set today's pick, creating the row or replacing its task list.
 *
 * An upsert rather than separate create/update endpoints, because the caller
 * genuinely doesn't care which it is — there is one row per date and the client
 * knows the date, not the documentId.
 *
 * Read-then-write, which Strapi cannot do atomically (no compare-and-set). Two
 * simultaneous writes for the same date could each miss the other's row and
 * create a duplicate; the GET above takes the first, so the effect is a lost
 * update rather than corruption. Acceptable here — a person picking tasks in one
 * browser is not a concurrent workload — and the same caveat as the moon-phase
 * reset and the auth rate limiter.
 */
export async function PUT(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { date, tasks } = await req.json();
    if (!date) {
      return NextResponse.json(
        { success: false, error: 'date is required' },
        { status: 400 }
      );
    }

    const existing = await fetchAllPages<{ documentId: string }>(
      token,
      `/api/daily-picks?filters[date][$eq]=${encodeURIComponent(date)}`
    );

    const path = existing[0]
      ? `/api/daily-picks/${existing[0].documentId}`
      : '/api/daily-picks';

    const response = await strapiFetch(
      token,
      `${path}?populate[tasks][populate]=project`,
      {
        method: existing[0] ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { date, tasks: tasks ?? [] } }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error('Failed to save daily pick:', detail);
      return NextResponse.json(
        { success: false, error: 'Failed to save daily pick' },
        { status: response.status }
      );
    }

    const saved = await response.json();
    return NextResponse.json({ success: true, data: saved.data });
  } catch (error) {
    console.error('Error saving daily pick:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
