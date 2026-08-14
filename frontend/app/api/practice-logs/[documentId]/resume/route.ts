import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { resumeSegments } from '@/app/lib/practiceSession';
import {
  fetchSession,
  isFinished,
  segmentsOf,
  withSessionLock,
  writeSession,
} from '@/app/lib/practiceSessionServer';

/**
 * Open a new stretch. Idempotent: resuming a running session is a no-op.
 *
 * A stopped session cannot be resumed — `stop` is the one irreversible step, and
 * re-opening a row whose duration has been banked would put a second, later
 * segment on a session that is already counted. Start a new session instead.
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

      if (isFinished(row)) {
        return NextResponse.json(
          { success: false, error: 'That session is finished' },
          { status: 409 }
        );
      }

      const segments = segmentsOf(row);
      const resumed = resumeSegments(segments, new Date());
      if (resumed === segments) {
        return NextResponse.json({ success: true, data: row });
      }

      const data = await writeSession(token, documentId, { segments: resumed });
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Failed to resume practice session' },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, data });
    });
  } catch (error) {
    console.error('Error resuming practice session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
