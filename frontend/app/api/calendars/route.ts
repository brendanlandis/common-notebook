import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';
import { toClientCalendar, type CalendarRow } from '@/app/lib/ics/clientCalendar';

/**
 * Calendar subscriptions.
 *
 * **`icsUrl` never leaves this layer.** It is a bearer secret — anyone holding
 * a Google secret ICS URL can read that whole calendar, with no account and no
 * revocation short of rotating the link. It cannot be marked `private` in the
 * schema, because Strapi strips private fields from *every* response including
 * the ones this server makes, which would leave the poller unable to read the
 * URL it exists to fetch. So the field stays readable server-side and is
 * removed here, on the way out.
 *
 * `toClientCalendar` is the only shape any handler here returns. It lives in
 * lib with its own tests, and the e2e spec asserts the actual HTTP body — a
 * unit test alone could not prove the route uses it.
 */

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const calendars = await fetchAllPages<CalendarRow>(
      token,
      '/api/calendar-subscriptions?sort=position:asc'
    );

    return NextResponse.json({ success: true, data: calendars.map(toClientCalendar) });
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { name, icsUrl, color, position, defaultState } = await req.json();
    if (!name || !icsUrl) {
      return NextResponse.json(
        { success: false, error: 'name and icsUrl are required' },
        { status: 400 }
      );
    }

    // Reject anything that isn't an https URL before it is stored. A stored
    // `javascript:` or `file:` value would later be handed to a server-side
    // fetch, which is a worse place to discover it.
    if (!/^https:\/\//i.test(String(icsUrl))) {
      return NextResponse.json(
        { success: false, error: 'icsUrl must be an https URL' },
        { status: 400 }
      );
    }

    const response = await strapiFetch(token, '/api/calendar-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          name,
          icsUrl,
          color: color ?? null,
          position: position ?? 0,
          defaultState: defaultState ?? 'unset',
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Failed to create calendar:', detail);
      return NextResponse.json(
        { success: false, error: 'Failed to create calendar' },
        { status: response.status }
      );
    }

    const created = await response.json();
    return NextResponse.json({ success: true, data: toClientCalendar(created.data) });
  } catch (error) {
    console.error('Error creating calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
