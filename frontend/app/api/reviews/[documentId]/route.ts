import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { strapiFetch } from '@/app/lib/strapiServer';

/**
 * Update a review — in practice, its task selection.
 *
 * The ownership middleware authorizes this by loading the row and comparing its
 * owner, so someone else's documentId comes back as a 404 rather than a 403
 * (which would confirm the id exists).
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
    // Only forward what was actually sent, so a PUT carrying just `tasks`
    // doesn't blank the period it belongs to.
    for (const field of ['periodStart', 'periodEnd', 'cycleType', 'anchorDate', 'tasks']) {
      if (field in body) data[field] = body[field];
    }

    const response = await strapiFetch(
      token,
      `/api/reviews/${documentId}?populate[tasks][populate]=project`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error(`Failed to update review ${documentId}:`, detail);
      return NextResponse.json(
        { success: false, error: 'Failed to update review' },
        { status: response.status }
      );
    }

    const updated = await response.json();
    return NextResponse.json({ success: true, data: updated.data });
  } catch (error) {
    console.error('Error updating review:', error);
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

    const response = await strapiFetch(token, `/api/reviews/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete review' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
