import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { strapiFetch } from '@/app/lib/strapiServer';
import { errorResponse } from '@/app/lib/errorResponse';

/**
 * The note on a whole session: `{ notes }`, plain text. The one thing about a
 * sitting that is written rather than derived — its date and subject are set
 * when it starts, and its minutes are its logs'.
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.notes !== null && typeof body.notes !== 'string') {
      return NextResponse.json({ success: false, error: 'notes must be text' }, { status: 400 });
    }
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

    const response = await strapiFetch(token, `/api/practice-sessions/${documentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { notes } }),
    });
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to save the session note' },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    return errorResponse('Error saving a session note:', error);
  }
}
