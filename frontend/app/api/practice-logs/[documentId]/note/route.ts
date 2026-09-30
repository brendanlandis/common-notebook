import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { withSessionLock, writeLogNote } from '@/app/lib/practiceSessionServer';
import { errorResponse } from '@/app/lib/errorResponse';

/**
 * What was written about one piece's stretch, after it closed: the note, and the
 * tempo reached if the piece has a tempo. Asked for when you switch away from a
 * piece and when you stop.
 *
 * `{ notes?: string, tempoReached?: number | null }`. A key left out is left
 * alone. The tempo reached also becomes the piece's current tempo.
 */
export async function POST(
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
    const notes = body.notes;
    const tempoReached = body.tempoReached;
    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      return NextResponse.json({ success: false, error: 'notes must be text' }, { status: 400 });
    }
    if (
      tempoReached !== undefined &&
      tempoReached !== null &&
      !(Number.isInteger(tempoReached) && (tempoReached as number) > 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'tempoReached must be a whole number of bpm' },
        { status: 400 }
      );
    }

    return await withSessionLock(documentId, async () => {
      const data = await writeLogNote(token, documentId, {
        notes: notes as string | null | undefined,
        tempoReached: tempoReached as number | null | undefined,
      });
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Failed to save the note' },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, data });
    });
  } catch (error) {
    return errorResponse('Error saving a practice note:', error);
  }
}
