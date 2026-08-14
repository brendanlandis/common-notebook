import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, getTimeZoneSettings, strapiFetch } from '@/app/lib/strapiServer';
import { getEffectiveDayForTimestamp } from '@/app/lib/dayBoundaryHelpers';
import { fetchOpenSession } from '@/app/lib/practiceSessionServer';

/** Material and its subject, so a session can name what it is without a second fetch. */
const POPULATE = 'populate[material][populate][0]=project';

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // `material` replaces the old `type` filter — sessions hang off a task now,
    // not off a six-value enum. Passing none returns every session, which is
    // what the history page wants.
    const { searchParams } = new URL(req.url);
    const material = searchParams.get('material');
    const date = searchParams.get('date');

    // `pageSize=200` used to be requested here; Strapi clamps to 100 without
    // saying so. fetchAllPages pages properly instead.
    let queryString = `?sort[0]=start:desc&${POPULATE}`;
    if (material) {
      queryString += `&filters[material][documentId][$eq]=${encodeURIComponent(material)}`;
    }
    if (date) {
      queryString += `&filters[date][$eq]=${encodeURIComponent(date)}`;
    }

    const logs = await fetchAllPages(token, `/api/practice-logs${queryString}`);

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching practice logs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Start practising a piece of material.
 *
 * The body is just `{ material }`. Everything else about a session's beginning —
 * the instant, the effective day, the first segment — is stamped here, because
 * it is the same division as everywhere else in this feature: the client says
 * what it meant and the server decides what that means. The page used to compute
 * its own `date` with `getEffectiveDayForTimestamp` and the stop route computed
 * it again, which worked only for as long as the two agreed.
 *
 * **One open session at a time, globally.** Not per material: two sessions
 * running at once is not a state the modal can render or the totals can survive,
 * and "the open one" is the question every reader asks. A second start answers
 * 409 with the session already running, so the caller can show that one rather
 * than silently opening a rival.
 */
export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const material = (body as Record<string, unknown>).material;
    if (typeof material !== 'string' || material.length === 0) {
      return NextResponse.json(
        { success: false, error: 'material is required' },
        { status: 400 }
      );
    }

    const open = await fetchOpenSession(token);
    if (open) {
      return NextResponse.json(
        { success: false, error: 'A session is already running', data: open },
        { status: 409 }
      );
    }

    const now = new Date();
    const settings = await getTimeZoneSettings(token);

    const response = await strapiFetch(token, `/api/practice-logs?${POPULATE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          material,
          start: now.toISOString(),
          stop: null,
          duration: 0,
          // The effective day, not the calendar day: a session begun at 1am under
          // a 4am boundary belongs to the previous day, and the stop route files
          // it under the same one.
          date: getEffectiveDayForTimestamp(now, settings),
          segments: [{ start: now.toISOString(), stop: null }],
          notes: [],
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to start practice session' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Error starting practice session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
