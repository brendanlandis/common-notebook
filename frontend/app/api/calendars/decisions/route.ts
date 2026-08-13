import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';

/**
 * Show/hide decisions for calendar events.
 *
 * `GET` returns the lot — the whole decision list, not a window of it. It is a
 * handful of rows against our own database, and it is fetched separately from
 * the events precisely so that changing one costs a cheap local round trip
 * instead of re-polling every ICS feed. The client resolves the two together.
 *
 * `PUT` is an upsert keyed on `(calendar, uid, recurrenceId)`, because that
 * triple — not a documentId — is what the client knows. Sending `state: null`
 * deletes the row, which is how an instance override is cleared back to
 * inheriting from its series: unset is the *absence* of a row at every tier, so
 * "clear" is a delete rather than a third state.
 *
 * Read-then-write, which Strapi cannot do atomically — it has no compare-and-set.
 * Two writes racing for the same triple could each miss the other and create a
 * duplicate; the resolver takes whichever it indexes last, so the effect is a
 * lost update rather than corruption. Same caveat as the daily-pick upsert, the
 * moon-phase reset, and the auth rate limiter, and acceptable for one person
 * clicking events in one browser.
 */

interface DecisionRow {
  documentId: string;
  uid?: string;
  recurrenceId?: string | null;
  state?: 'show' | 'hide';
  calendar?: { documentId: string } | null;
}

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await fetchAllPages<DecisionRow>(
      token,
      '/api/calendar-event-decisions?populate=calendar'
    );

    return NextResponse.json({
      success: true,
      data: rows
        // A decision whose calendar has been deleted can no longer resolve
        // against anything; drop it rather than handing the client a row with a
        // null key to trip over.
        .filter((row) => row.calendar?.documentId && row.uid && row.state)
        .map((row) => ({
          documentId: row.documentId,
          uid: row.uid,
          recurrenceId: row.recurrenceId ?? null,
          state: row.state,
          calendarDocumentId: row.calendar!.documentId,
        })),
    });
  } catch (error) {
    console.error('Error fetching calendar decisions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** Strapi has no null-equality shorthand, so a series-level lookup needs $null. */
function matchQuery(calendar: string, uid: string, recurrenceId: string | null): string {
  const base =
    `/api/calendar-event-decisions?filters[calendar][documentId][$eq]=${encodeURIComponent(calendar)}` +
    `&filters[uid][$eq]=${encodeURIComponent(uid)}`;
  return recurrenceId === null
    ? `${base}&filters[recurrenceId][$null]=true`
    : `${base}&filters[recurrenceId][$eq]=${encodeURIComponent(recurrenceId)}`;
}

export async function PUT(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { calendar, uid, recurrenceId = null, state } = await req.json();
    if (!calendar || !uid) {
      return NextResponse.json(
        { success: false, error: 'calendar and uid are required' },
        { status: 400 }
      );
    }
    if (state !== null && state !== 'show' && state !== 'hide') {
      return NextResponse.json(
        { success: false, error: 'state must be show, hide, or null' },
        { status: 400 }
      );
    }

    const existing = await fetchAllPages<DecisionRow>(
      token,
      matchQuery(calendar, uid, recurrenceId)
    );

    if (state === null) {
      // Clearing back to inherit. Deleting every match rather than the first
      // tidies up any duplicate a lost update may have left behind.
      for (const row of existing) {
        await strapiFetch(token, `/api/calendar-event-decisions/${row.documentId}`, {
          method: 'DELETE',
        });
      }
      return NextResponse.json({ success: true, data: null });
    }

    const path = existing[0]
      ? `/api/calendar-event-decisions/${existing[0].documentId}`
      : '/api/calendar-event-decisions';

    const response = await strapiFetch(token, path, {
      method: existing[0] ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { calendar, uid, recurrenceId, state } }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Failed to save calendar decision:', detail);
      return NextResponse.json(
        { success: false, error: 'Failed to save decision' },
        { status: response.status }
      );
    }

    const saved = await response.json();
    return NextResponse.json({ success: true, data: saved.data });
  } catch (error) {
    console.error('Error saving calendar decision:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
