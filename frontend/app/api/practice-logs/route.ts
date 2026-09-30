import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, getTimeZoneSettings, strapiFetch } from '@/app/lib/strapiServer';
import { getEffectiveDayForTimestamp } from '@/app/lib/dayBoundaryHelpers';
import {
  createPracticeSession,
  fetchOpenSession,
  LOG_POPULATE,
  subjectOf,
} from '@/app/lib/practiceSessionServer';
import { errorResponse } from '@/app/lib/errorResponse';

/**
 * Material and its subject, so a log can name what it is without a second fetch,
 * and its session's documentId, so history can put a log under its sitting.
 */
const POPULATE =
  'populate[material][populate][0]=project&populate[session][fields][0]=documentId';

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
    return errorResponse('Error fetching practice logs:', error);
  }
}

/**
 * Start practicing a piece of material.
 *
 * The body is just `{ material }`. Everything else about a session's beginning —
 * the instant, the effective day, the first segment — is stamped here, because
 * it is the same division as everywhere else in this feature: the client says
 * what it meant and the server decides what that means. The page used to compute
 * its own `date` with `getEffectiveDayForTimestamp` and the stop route computed
 * it again, which worked only for as long as the two agreed.
 *
 * It opens the *session* too — the sitting, filed under the piece's subject —
 * and this piece's stretch is the first log in it. "Switch to" adds the next.
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
    // The effective day, not the calendar day: a session begun at 1am under
    // a 4am boundary belongs to the previous day, and the stop route files
    // it under the same one.
    const date = getEffectiveDayForTimestamp(now, settings);

    const sitting = await createPracticeSession(token, {
      date,
      subject: await subjectOf(token, material),
    });
    if (!sitting) {
      return NextResponse.json(
        { success: false, error: 'Failed to start practice session' },
        { status: 502 }
      );
    }

    const response = await strapiFetch(token, `/api/practice-logs?${LOG_POPULATE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          material,
          session: sitting.documentId,
          start: now.toISOString(),
          stop: null,
          duration: 0,
          date,
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
    return errorResponse('Error starting practice session:', error);
  }
}
