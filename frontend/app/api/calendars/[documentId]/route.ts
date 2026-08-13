import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';
import { toClientCalendar, type CalendarRow } from '@/app/lib/ics/clientCalendar';

/**
 * Update or remove one calendar subscription.
 *
 * As everywhere else here, the response goes through `toClientCalendar` so the
 * ICS URL never reaches the browser.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const field of ['name', 'color', 'position', 'defaultState']) {
      if (field in body) data[field] = body[field];
    }
    // icsUrl is accepted on update too, but only when it looks like one — the
    // same guard as create, since a stored non-https value would later be
    // handed to a server-side fetch.
    if (body.icsUrl !== undefined) {
      if (!/^https:\/\//i.test(String(body.icsUrl))) {
        return NextResponse.json(
          { success: false, error: 'icsUrl must be an https URL' },
          { status: 400 }
        );
      }
      data.icsUrl = body.icsUrl;
    }

    const response = await strapiFetch(token, `/api/calendar-subscriptions/${documentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to update calendar' },
        { status: response.status }
      );
    }

    const updated = await response.json();
    return NextResponse.json({ success: true, data: toClientCalendar(updated.data) });
  } catch (error) {
    console.error('Error updating calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Remove the calendar's decisions first. Strapi does not cascade, and an
    // orphaned decision would silently re-apply itself if the same feed were
    // ever added back — a hidden event staying hidden for reasons no longer
    // visible anywhere in the UI.
    const decisions = await fetchAllPages<{ documentId: string }>(
      token,
      `/api/calendar-event-decisions?filters[calendar][documentId][$eq]=${encodeURIComponent(documentId)}`
    );
    for (const decision of decisions) {
      await strapiFetch(token, `/api/calendar-event-decisions/${decision.documentId}`, {
        method: 'DELETE',
      });
    }

    const response = await strapiFetch(token, `/api/calendar-subscriptions/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete calendar' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export type { CalendarRow };
