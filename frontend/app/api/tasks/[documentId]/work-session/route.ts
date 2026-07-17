import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';
import { getISOTimestamp } from '@/app/lib/dateUtils';
import { getEffectiveDayForTimestamp } from '@/app/lib/dayBoundaryHelpers';
import type { Task } from '@/app/types/index';

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

    // The client used to post its own timezone here, because the server had no
    // way to resolve one. It does now, from the caller's token.
    const settings = await getTimeZoneSettings(token);

    // Get the task
    const getTaskResponse = await fetch(
      `${STRAPI_API_URL}/api/tasks/${documentId}?populate=project`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!getTaskResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch task' },
        { status: getTaskResponse.status }
      );
    }

    const taskData = await getTaskResponse.json();
    const task: Task = taskData.data;

    // Validate that this is a long task
    if (!task.long) {
      return NextResponse.json(
        { success: false, error: 'This task is not marked as long' },
        { status: 400 }
      );
    }

    // Effective day and timestamp for this session, from the one shared
    // implementation. getEffectiveDayForTimestamp is the same function the Done page
    // groups by, and getISOTimestamp is what task completion writes — so a work
    // session and a completion at the same instant always agree on the day, and the
    // boundary logic lives in exactly one place. (This route used to hand-roll both.)
    const now = new Date();
    const todayDate = getEffectiveDayForTimestamp(now, settings);
    const timestamp = getISOTimestamp(settings, now);

    // Get existing workSessions or initialize as empty array
    const workSessions = task.workSessions || [];

    // Check if there's already a session for today
    const existingSessionIndex = workSessions.findIndex(ws => ws.date === todayDate);
    
    if (existingSessionIndex >= 0) {
      // Already worked on today, don't add another session
      return NextResponse.json({
        success: true,
        data: task,
        message: 'Work session already exists for today',
      });
    }

    // Add new work session
    workSessions.push({ date: todayDate, timestamp });

    // Update the task with the new workSessions
    const updateResponse = await fetch(
      `${STRAPI_API_URL}/api/tasks/${documentId}?populate=project`,
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
        { success: false, error: 'Failed to update task' },
        { status: updateResponse.status }
      );
    }

    const updatedTaskData = await updateResponse.json();

    return NextResponse.json({
      success: true,
      data: updatedTaskData.data,
    });
  } catch (error) {
    console.error('Error adding work session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

