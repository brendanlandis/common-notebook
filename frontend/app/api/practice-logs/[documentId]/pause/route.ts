import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { pauseSegments, durationMinutes } from '@/app/lib/practiceSession';
import {
  fetchSession,
  segmentsOf,
  withSessionLock,
  writeSession,
} from '@/app/lib/practiceSessionServer';

/**
 * Pause the running stretch. Idempotent: pausing a paused session is a no-op.
 *
 * `duration` is written on every pause, not only on stop, so the number on the
 * row is always current — a session abandoned while paused still reports what
 * was actually practised, and nothing has to reconstruct it later.
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

    return await withSessionLock(documentId, async () => {
      const row = await fetchSession(token, documentId);
      if (!row) {
        return NextResponse.json(
          { success: false, error: 'No such practice session' },
          { status: 404 }
        );
      }

      const segments = segmentsOf(row);
      const paused = pauseSegments(segments, new Date());

      // Nothing was running. Answer with the row as it stands rather than
      // writing: a second device re-asserting a pause must not move a stop time
      // that is already recorded.
      if (paused === segments) {
        return NextResponse.json({ success: true, data: row });
      }

      const data = await writeSession(token, documentId, {
        segments: paused,
        duration: durationMinutes(paused, new Date()),
      });
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Failed to pause practice session' },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, data });
    });
  } catch (error) {
    console.error('Error pausing practice session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
