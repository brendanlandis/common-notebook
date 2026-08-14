import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';
import { getEffectiveDayForTimestamp } from '@/app/lib/dayBoundaryHelpers';
import { pauseSegments, sessionStart } from '@/app/lib/practiceSession';
import {
  fetchSession,
  segmentsOf,
  withSessionLock,
  writeSession,
} from '@/app/lib/practiceSessionServer';

/**
 * "I left this running — call it 45 minutes."
 *
 * The one place a duration comes from the client rather than from the segments,
 * and deliberately so: when a session has been open for four hours the segments
 * are measuring how long the tab was open, and the only thing that knows how
 * long you actually practised is you.
 *
 * This is why there is no heartbeat. A timer writing "still here" every minute
 * would produce a confident number for a session you walked away from, because
 * it measures the tab rather than the practice. Asking is less clever and more
 * correct.
 *
 * The segments are kept as they were (with the open stretch closed) rather than
 * rewritten to match the corrected total. They are a record of what happened;
 * `duration` is the claim about it, and flattening the first into the second
 * would destroy the evidence that the correction was needed at all.
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
    const minutes = Number((body as Record<string, unknown>).minutes);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
      return NextResponse.json(
        { success: false, error: 'minutes must be a number of minutes in a day' },
        { status: 400 }
      );
    }

    return await withSessionLock(documentId, async () => {
      const row = await fetchSession(token, documentId);
      if (!row) {
        return NextResponse.json(
          { success: false, error: 'No such practice session' },
          { status: 404 }
        );
      }

      const now = new Date();
      const segments = pauseSegments(segmentsOf(row), now);
      const settings = await getTimeZoneSettings(token);
      const started = row.start ?? sessionStart(segments);
      const date = started
        ? getEffectiveDayForTimestamp(new Date(started), settings)
        : getEffectiveDayForTimestamp(now, settings);

      const data = await writeSession(token, documentId, {
        segments,
        // Correcting an already-stopped session leaves its stop time alone; only
        // the claim about how long it was changes.
        stop: row.stop ?? now.toISOString(),
        duration: Math.round(minutes),
        date,
      });
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Failed to correct practice session' },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, data });
    });
  } catch (error) {
    console.error('Error correcting practice session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
