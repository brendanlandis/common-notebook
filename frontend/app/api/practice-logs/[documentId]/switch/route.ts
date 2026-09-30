import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTimeZoneSettings, strapiFetch } from '@/app/lib/strapiServer';
import { getEffectiveDayForTimestamp } from '@/app/lib/dayBoundaryHelpers';
import { pauseSegments, durationMinutes } from '@/app/lib/practiceSession';
import {
  createPracticeSession,
  fetchOpenSession,
  fetchSession,
  isFinished,
  LOG_POPULATE,
  segmentsOf,
  subjectOf,
  withSessionLock,
  writeSession,
} from '@/app/lib/practiceSessionServer';
import { errorResponse } from '@/app/lib/errorResponse';

/**
 * Move a running session on to another piece without stopping the clock.
 *
 * The open stretch closes — its minutes banked exactly as a stop banks them —
 * and a new one opens on `material` in the **same** sitting, filed under the
 * sitting's day, so a session that crosses midnight stays one session in
 * history. The note on the piece being left is written afterwards, through
 * `/note`, while the new piece's clock is already running.
 *
 * Idempotent, like every intent. Switching to the piece already running changes
 * nothing. A stale client replaying a switch the server already made — this
 * stretch closed, and the open one is the target, in the same sitting — gets
 * that open stretch back. Anything else against a closed stretch is refused:
 * a finished session never reopens.
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

    const body = await req.json().catch(() => ({}));
    const material = (body as Record<string, unknown>).material;
    if (typeof material !== 'string' || material.length === 0) {
      return NextResponse.json(
        { success: false, error: 'material is required' },
        { status: 400 }
      );
    }

    return await withSessionLock(documentId, async () => {
      const row = await fetchSession(
        token,
        documentId,
        'populate[material][fields][0]=documentId&populate[session][fields][0]=date'
      );
      if (!row) {
        return NextResponse.json(
          { success: false, error: 'No such practice session' },
          { status: 404 }
        );
      }

      if (isFinished(row)) {
        const open = await fetchOpenSession(token);
        const replayed =
          open &&
          open.material?.documentId === material &&
          open.session?.documentId === row.session?.documentId;
        if (replayed) return NextResponse.json({ success: true, data: open });
        return NextResponse.json(
          { success: false, error: 'This session has already finished', data: open },
          { status: 409 }
        );
      }

      if (row.material?.documentId === material) {
        return NextResponse.json({ success: true, data: row });
      }

      const now = new Date();
      const segments = pauseSegments(segmentsOf(row), now);
      const closed = await writeSession(token, documentId, {
        segments,
        stop: now.toISOString(),
        duration: durationMinutes(segments, now),
      });
      if (!closed) {
        return NextResponse.json(
          { success: false, error: 'Failed to switch pieces' },
          { status: 502 }
        );
      }

      // A stretch begun before sessions existed has no sitting; give it one
      // now, so the pieces after it are grouped with it.
      const settings = await getTimeZoneSettings(token);
      const date =
        row.session?.date ?? row.date ?? getEffectiveDayForTimestamp(now, settings);
      let sitting = row.session?.documentId ?? null;
      if (!sitting) {
        const created = await createPracticeSession(token, {
          date,
          subject: await subjectOf(token, material),
        });
        sitting = created?.documentId ?? null;
        if (sitting) await writeSession(token, documentId, { session: sitting });
      }

      const response = await strapiFetch(token, `/api/practice-logs?${LOG_POPULATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            material,
            session: sitting,
            start: now.toISOString(),
            stop: null,
            duration: 0,
            date,
            segments: [{ start: now.toISOString(), stop: null }],
            notes: [],
          },
        }),
      });
      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to switch pieces' },
          { status: response.status }
        );
      }
      const created = await response.json();
      return NextResponse.json({ success: true, data: created.data, closed });
    });
  } catch (error) {
    return errorResponse('Error switching practice pieces:', error);
  }
}
