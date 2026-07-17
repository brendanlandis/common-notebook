import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';
import { getEffectiveDayForTimestamp } from '@/app/lib/dayBoundaryHelpers';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First, fetch the current practice log to get the start time
    const getResponse = await fetch(
      `${STRAPI_API_URL}/api/practice-logs/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!getResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch practice log' },
        { status: getResponse.status }
      );
    }

    const logData = await getResponse.json();
    const practiceLog = logData.data;

    if (!practiceLog.start) {
      return NextResponse.json(
        { success: false, error: 'Practice log has no start time' },
        { status: 400 }
      );
    }

    // Calculate stop time and duration
    const stopTime = new Date().toISOString();
    const startTime = new Date(practiceLog.start);
    const stopTimeDate = new Date(stopTime);
    const durationMinutes = Math.round((stopTimeDate.getTime() - startTime.getTime()) / (1000 * 60));

    // Effective day of the session's start, in the owner's timezone and honoring
    // their day boundary. The old `practiceLog.start.split('T')[0]` took the UTC
    // date off the datetime, jumping any session started after ~20:00 EDT to the
    // next day in the stats chart. Matches what the client wrote at start.
    const settings = await getTimeZoneSettings(token);
    const date = getEffectiveDayForTimestamp(startTime, settings);

    // Update the practice log with stop time, duration, and date
    const updateBody = {
      stop: stopTime,
      duration: durationMinutes,
      date: date,
    };

    const updateResponse = await fetch(
      `${STRAPI_API_URL}/api/practice-logs/${documentId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: updateBody }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to stop practice log' },
        { status: updateResponse.status }
      );
    }

    const data = await updateResponse.json();
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Error stopping practice log:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

