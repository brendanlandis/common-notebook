import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';
import { getEffectiveDayForTimestamp } from '@/app/lib/dayBoundaryHelpers';
import { pauseSegments, durationMinutes, sessionStart } from '@/app/lib/practiceSession';
import {
  fetchSession,
  isFinished,
  segmentsOf,
  withSessionLock,
  writeSession,
} from '@/app/lib/practiceSessionServer';

/**
 * Finish a session: close the open stretch, bank the duration, stamp `stop`.
 *
 * `duration` is the **sum of the segments**, not `stop - start`. Those were the
 * same number until sessions could be paused; now a 40-minute sitting with 15
 * minutes of pause is 25 minutes practiced, and only the segments know that.
 *
 * Idempotent: stopping a stopped session returns it untouched rather than
 * rewriting `stop` to a later instant. That matters because two devices share a
 * session, and the one in your pocket will re-assert things.
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
        return NextResponse.json({ success: true, data: row });
      }

      const now = new Date();
      const segments = pauseSegments(segmentsOf(row), now);

      // The effective day of the session's *start*, so a session that runs past
      // the day boundary is filed under the day it began. The old code read the
      // UTC date straight off the datetime string, which moved any session
      // started after ~20:00 EDT into the next day on the chart.
      //
      // `start` is the column, falling back to the first segment for a row
      // written before it existed — both are the same instant.
      const settings = await getTimeZoneSettings(token);
      const started = row.start ?? sessionStart(segments);
      const date = started
        ? getEffectiveDayForTimestamp(new Date(started), settings)
        : getEffectiveDayForTimestamp(now, settings);

      const data = await writeSession(token, documentId, {
        segments,
        stop: now.toISOString(),
        duration: durationMinutes(segments, now),
        date,
      });
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Failed to stop practice session' },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, data });
    });
  } catch (error) {
    console.error('Error stopping practice session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
