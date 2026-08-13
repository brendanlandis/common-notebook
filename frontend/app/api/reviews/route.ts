import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';

/**
 * Reviews — the record of a planning session and what it committed to.
 *
 * Ownership is enforced by the backend middleware from the caller's token, so
 * nothing here filters by user; a review belonging to someone else is simply not
 * in the result. The `owner` relation is never sent: it is private *and* points
 * at the user model, so Strapi would reject the write on two separate rules.
 */

/**
 * The most recent review, or the one covering a given date.
 *
 * `?on=YYYY-MM-DD` asks "which review covers this day", which is how the daily
 * page finds the plan it should be reading off. Filtering server-side rather
 * than fetching all and picking in JS — Strapi silently clamps a page size, so a
 * client-side scan would quietly start missing older reviews.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const on = new URL(req.url).searchParams.get('on');

    const query = on
      ? `/api/reviews?filters[periodStart][$lte]=${encodeURIComponent(on)}` +
        `&filters[periodEnd][$gte]=${encodeURIComponent(on)}` +
        '&populate[tasks][populate]=project&sort=periodStart:desc'
      : '/api/reviews?populate[tasks][populate]=project&sort=periodStart:desc';

    const reviews = await fetchAllPages(token, query);

    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
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

    const body = await req.json();
    const { periodStart, periodEnd, cycleType, anchorDate, tasks } = body;

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: 'periodStart and periodEnd are required' },
        { status: 400 }
      );
    }

    const response = await strapiFetch(token, '/api/reviews?populate[tasks][populate]=project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          periodStart,
          periodEnd,
          cycleType: cycleType ?? null,
          anchorDate: anchorDate ?? null,
          tasks: tasks ?? [],
        },
      }),
    });

    if (!response.ok) {
      // Surface Strapi's own message. A silent failure here is the shape of bug
      // that let every project save send an invalid projectType for months.
      const detail = await response.text();
      console.error('Failed to create review:', detail);
      return NextResponse.json(
        { success: false, error: 'Failed to create review' },
        { status: response.status }
      );
    }

    const created = await response.json();
    return NextResponse.json({ success: true, data: created.data });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
