import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, getTimeZoneSettings } from '@/app/lib/strapiServer';
import { expandIcs } from '@/app/lib/ics/expandIcs';
import { resolveDecisions, type StoredDecision } from '@/app/lib/ics/resolveDecisions';
import type { CalendarRow } from '@/app/lib/ics/clientCalendar';

/**
 * The week's events, resolved.
 *
 * Polls each subscribed ICS feed **server-side** — for CORS, and because the
 * feed URLs are bearer secrets that must not reach the browser — expands them to
 * the caller's wall clock, and applies their stored show/hide decisions.
 *
 * Always live. Nothing is frozen and there is no snapshot: an earlier design
 * cached a "bounce" of the week, but the two things that justified it (a
 * planned-against capacity figure, and a baseline for scoring the week
 * afterwards) are both gone from this feature. An event added mid-week simply
 * turns up as unset, which is already visible and already actionable.
 */

interface DecisionRow {
  documentId: string;
  uid: string;
  recurrenceId: string | null;
  state: 'show' | 'hide';
  calendar?: { documentId: string } | null;
}

/**
 * Fetch one feed, with a timeout.
 *
 * A calendar host that accepts the connection and then never answers would
 * otherwise hang the whole request behind it — and this endpoint fans out over
 * every subscription the user has, so one slow host must not decide how long
 * the review page takes to load.
 */
async function fetchIcs(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      // Google refreshes secret ICS on its own schedule and can lag by hours;
      // there is nothing to gain from a cached copy on top of that.
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error(`Calendar feed responded ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    // Never rethrow: one unreachable calendar must not empty the other three.
    console.error('Failed to fetch calendar feed:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'start and end are required' },
        { status: 400 }
      );
    }

    const settings = await getTimeZoneSettings(token);

    const [calendars, decisionRows] = await Promise.all([
      fetchAllPages<CalendarRow>(token, '/api/calendar-subscriptions?sort=position:asc'),
      fetchAllPages<DecisionRow>(token, '/api/calendar-event-decisions?populate=calendar'),
    ]);

    // Fan out rather than awaiting each in turn: four calendars at 300ms each is
    // a second and a bit of the page's load spent waiting in series.
    const feeds = await Promise.all(
      calendars.map(async (calendar) => ({
        calendar,
        ics: calendar.icsUrl ? await fetchIcs(calendar.icsUrl) : null,
      }))
    );

    const events = feeds.flatMap(({ calendar, ics }) => {
      if (!ics) return [];
      const decisions: StoredDecision[] = decisionRows
        .filter((row) => row.calendar?.documentId === calendar.documentId)
        .map((row) => ({
          documentId: row.documentId,
          uid: row.uid,
          recurrenceId: row.recurrenceId,
          state: row.state,
          calendarDocumentId: calendar.documentId,
        }));

      return resolveDecisions(
        expandIcs(ics, start, end, settings),
        decisions,
        calendar.documentId,
        calendar.defaultState ?? 'unset'
      ).map((instance) => ({ ...instance, color: calendar.color ?? null }));
    });

    // Calendars are reported alongside, so the UI can colour and name events
    // without a second request — and without the icsUrl, which never leaves here.
    return NextResponse.json({
      success: true,
      data: events,
      calendars: calendars.map((calendar) => ({
        documentId: calendar.documentId,
        name: calendar.name,
        color: calendar.color ?? null,
        unreachable: !feeds.find((f) => f.calendar.documentId === calendar.documentId)?.ics,
      })),
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
