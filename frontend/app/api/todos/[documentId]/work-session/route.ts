import { NextRequest, NextResponse } from 'next/server';
import type { Todo } from '@/app/types/admin';
import { toZonedTime } from 'date-fns-tz';
import { format as formatTz } from 'date-fns-tz';
import { addDays } from 'date-fns';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get timezone from request body
    const body = await req.json();
    const timezone = body.timezone || 'America/New_York';

    // Fetch day boundary hour setting
    const dayBoundaryResponse = await fetch(
      `${req.nextUrl.origin}/api/system-settings?title=dayBoundaryHour`,
      {
        headers: {
          Cookie: req.headers.get('cookie') || '',
        },
      }
    );

    let dayBoundaryHour = 0; // Default to midnight
    if (dayBoundaryResponse.ok) {
      const dayBoundaryData = await dayBoundaryResponse.json();
      if (dayBoundaryData.success && dayBoundaryData.value) {
        const parsedHour = parseInt(dayBoundaryData.value, 10);
        if (!isNaN(parsedHour) && parsedHour >= 0 && parsedHour <= 23) {
          dayBoundaryHour = parsedHour;
        }
      }
    }

    // Get the todo
    const getTodoResponse = await fetch(
      `${STRAPI_API_URL}/api/todos/${documentId}?populate=project`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!getTodoResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch todo' },
        { status: getTodoResponse.status }
      );
    }

    const todoData = await getTodoResponse.json();
    const todo: Todo = todoData.data;

    // Validate that this is a long todo
    if (!todo.long) {
      return NextResponse.json(
        { success: false, error: 'This todo is not marked as long' },
        { status: 400 }
      );
    }

    // Get today's date in the configured timezone as YYYY-MM-DD
    // Use a single Date object for both to ensure consistency
    const now = new Date();
    const nowInTimezone = toZonedTime(now, timezone);
    
    // Apply day boundary logic: if before the day boundary hour, use previous calendar day
    const currentHour = nowInTimezone.getHours();
    let effectiveDate = nowInTimezone;
    if (currentHour < dayBoundaryHour) {
      effectiveDate = addDays(nowInTimezone, -1);
    }
    
    const todayDate = formatTz(effectiveDate, 'yyyy-MM-dd', { timeZone: timezone });
    const timestamp = formatTz(nowInTimezone, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", { timeZone: timezone });

    // Get existing workSessions or initialize as empty array
    const workSessions = todo.workSessions || [];

    // Check if there's already a session for today
    const existingSessionIndex = workSessions.findIndex(ws => ws.date === todayDate);
    
    if (existingSessionIndex >= 0) {
      // Already worked on today, don't add another session
      return NextResponse.json({
        success: true,
        data: todo,
        message: 'Work session already exists for today',
      });
    }

    // Add new work session
    workSessions.push({ date: todayDate, timestamp });

    // Update the todo with the new workSessions
    const updateResponse = await fetch(
      `${STRAPI_API_URL}/api/todos/${documentId}?populate=project`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            workSessions,
          },
        }),
      }
    );

    if (!updateResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to update todo' },
        { status: updateResponse.status }
      );
    }

    const updatedTodoData = await updateResponse.json();

    return NextResponse.json({
      success: true,
      data: updatedTodoData.data,
    });
  } catch (error) {
    console.error('Error adding work session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

