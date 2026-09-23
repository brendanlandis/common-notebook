import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import type { Task } from '@/app/types/index';
import { errorResponse } from '@/app/lib/errorResponse';
import { strapiFetch } from '@/app/lib/strapiServer';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string; date: string }> }
) {
  try {
    const { documentId, date } = await params;
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the task
    const getTaskResponse = await strapiFetch(token, `/api/tasks/${documentId}?populate=project`);

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

    // Get existing workSessions or initialize as empty array
    const workSessions = task.workSessions || [];

    // Remove the work session for the specified date
    const filteredSessions = workSessions.filter(ws => ws.date !== date);

    if (filteredSessions.length === workSessions.length) {
      return NextResponse.json(
        { success: false, error: 'Work session not found for this date' },
        { status: 404 }
      );
    }

    // Update the task with the filtered workSessions
    const updateResponse = await strapiFetch(
      token,
      `/api/tasks/${documentId}?populate=project`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            workSessions: filteredSessions,
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
    return errorResponse('Error removing work session:', error);
  }
}

