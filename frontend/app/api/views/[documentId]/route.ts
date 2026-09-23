import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { strapiFetch } from '@/app/lib/strapiServer';
import { errorResponse } from '@/app/lib/errorResponse';

const VIEWS_POPULATE = 'populate[sections][populate][worlds]=true';

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

    const response = await strapiFetch(token, `/api/views/${documentId}?${VIEWS_POPULATE}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: body }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to update view' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    return errorResponse('Error updating view:', error);
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

    const response = await strapiFetch(token, `/api/views/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to delete view' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('Error deleting view:', error);
  }
}
