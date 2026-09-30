import { NextRequest, NextResponse } from 'next/server';
import { Temporal } from 'temporal-polyfill';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTimeZoneSettings, strapiFetch } from '@/app/lib/strapiServer';
import {
  createPracticeSession,
  noteBlocks,
  subjectOf,
  writeLogNote,
} from '@/app/lib/practiceSessionServer';
import { errorResponse } from '@/app/lib/errorResponse';

/**
 * Log practice done without the timer: `{ material, date, minutes, tempoReached?,
 * notes? }`.
 *
 * A finished sitting of its own, holding one stretch of the given minutes on the
 * given day. After `/correct`, this is the second place a duration comes from
 * the client, and for the same reason: nothing else can know it.
 *
 * There are no segments — there was no clock — so `start` and `stop` are both
 * midday of that day in the account's time zone. They exist only so the log sorts
 * among its day's sessions; `date` is what files it.
 */
export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { material, date, minutes, tempoReached, notes } = body;
    if (typeof material !== 'string' || material.length === 0) {
      return NextResponse.json({ success: false, error: 'material is required' }, { status: 400 });
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (!(Number.isInteger(minutes) && (minutes as number) > 0 && (minutes as number) <= 24 * 60)) {
      return NextResponse.json(
        { success: false, error: 'minutes must be a whole number between 1 and 1440' },
        { status: 400 }
      );
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

    const sitting = await createPracticeSession(token, {
      date,
      subject: await subjectOf(token, material),
    });
    if (!sitting) {
      return NextResponse.json({ success: false, error: 'Failed to log practice' }, { status: 502 });
    }

    const { timezone } = await getTimeZoneSettings(token);
    const midday = Temporal.PlainDate.from(date)
      .toZonedDateTime({ timeZone: timezone, plainTime: '12:00' })
      .toInstant()
      .toString();

    const response = await strapiFetch(token, '/api/practice-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          material,
          session: sitting.documentId,
          start: midday,
          stop: midday,
          duration: minutes,
          date,
          segments: [],
          notes: noteBlocks(typeof notes === 'string' ? notes : null),
        },
      }),
    });
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to log practice' },
        { status: response.status }
      );
    }
    const created = await response.json();

    // Through the note path, so the tempo reached moves the piece's tempo too.
    if (typeof tempoReached === 'number') {
      await writeLogNote(token, created.data.documentId, { tempoReached });
    }
    return NextResponse.json({ success: true, data: created.data });
  } catch (error) {
    return errorResponse('Error logging practice:', error);
  }
}
