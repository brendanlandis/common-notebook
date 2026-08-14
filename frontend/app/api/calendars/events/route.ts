import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, getTimeZoneSettings } from '@/app/lib/strapiServer';
import { expandIcs } from '@/app/lib/ics/expandIcs';
import { toClientCalendar, type CalendarRow } from '@/app/lib/ics/clientCalendar';

/**
 * The week's events.
 *
 * Polls each subscribed ICS feed **server-side** — for CORS, and because the
 * feed URLs are bearer secrets that must not reach the browser — and expands
 * them to the caller's wall clock.
 *
 * Deliberately does **not** apply show/hide decisions. This request is the
 * expensive one in the feature: it fans out to every subscribed feed, over the
 * network, with a 10-second timeout each. Resolving here meant that every click
 * on an event had to re-run all of it to see the new state, which is where the
 * several-second lag between clicking and anything happening came from. The
 * decisions are a short list served from our own database (`/decisions`), and
 * `resolveDecisions` is pure, so the client holds both and resolves — one
 * implementation of the rule, still, just running on the other side of the wire.
 *
 * Always live. Nothing is frozen and there is no snapshot: an earlier design
 * cached a "bounce" of the week, but the two things that justified it (a
 * planned-against capacity figure, and a baseline for scoring the week
 * afterwards) are both gone from this feature. An event added mid-week simply
 * turns up as unset, which is already visible and already actionable.
 */

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

    const calendars = await fetchAllPages<CalendarRow>(
      token,
      '/api/calendar-subscriptions?sort=position:asc'
    );

    // Fan out rather than awaiting each in turn: four calendars at 300ms each is
    // a second and a bit of the page's load spent waiting in series.
    const feeds = await Promise.all(
      calendars.map(async (calendar) => ({
        calendar,
        ics: calendar.icsUrl ? await fetchIcs(calendar.icsUrl) : null,
      }))
    );

    // Tagged with the calendar they came from, which is half of the key a
    // decision is stored against — the client needs it to resolve them.
    const events = feeds.flatMap(({ calendar, ics }) =>
      ics
        ? expandIcs(ics, start, end, settings).map((instance) => ({
            ...instance,
            calendarDocumentId: calendar.documentId,
          }))
        : []
    );

    // Calendars are reported alongside, so the UI can color and name events —
    // and resolve each one's default state — without a second request. Shaped by
    // `toClientCalendar`, which is what keeps the icsUrl from ever leaving here.
    return NextResponse.json({
      success: true,
      data: events,
      calendars: feeds.map(({ calendar, ics }) => ({
        ...toClientCalendar(calendar),
        unreachable: !ics,
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
