import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';

// BFF for the user's views (the `api::view.view` collection). Mirrors
// app/api/worlds. Ownership is enforced by Strapi's middleware, so every call is
// scoped to the caller; the owner is stamped server-side on create.
//
// Views carry an ordered list of `section` components, each with its own
// `worlds` relation — none of which Strapi populates by default — so the GET
// explicitly populates sections and their worlds.
const VIEWS_POPULATE = 'populate[sections][populate][worlds]=true';

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const views = await fetchAllPages(token, `/api/views?${VIEWS_POPULATE}`);
    return NextResponse.json({ success: true, data: views });
  } catch (error) {
    console.error('Error fetching views:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const response = await strapiFetch(token, `/api/views?${VIEWS_POPULATE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: body }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to create view' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Error creating view:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
