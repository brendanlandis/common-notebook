import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { calculateNextRecurrence } from '@/app/lib/recurrence';
import type { Task } from '@/app/types/index';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';

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

    // First, get the task to check if it's recurring
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

    // Only allow skipping for recurring tasks
    if (!task.isRecurring) {
      return NextResponse.json(
        { success: false, error: 'Task is not recurring' },
        { status: 400 }
      );
    }

    let newTask = null;

    // Create next instance
    const settings = await getTimeZoneSettings(token);
    const nextDates = calculateNextRecurrence(task, settings);

    if (nextDates.displayDate || nextDates.dueDate) {
      const createResponse = await fetch(`${STRAPI_API_URL}/api/tasks?populate=project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            title: task.title,
            description: task.description,
            dueDate: nextDates.dueDate,
            displayDate: nextDates.displayDate,
            displayDateOffset: task.displayDateOffset,
            completed: false,
            completedAt: null,
            isRecurring: task.isRecurring,
            recurrenceType: task.recurrenceType,
            recurrenceInterval: task.recurrenceInterval,
            recurrenceDayOfWeek: task.recurrenceDayOfWeek,
            recurrenceDayOfMonth: task.recurrenceDayOfMonth,
            recurrenceWeekOfMonth: task.recurrenceWeekOfMonth,
            recurrenceDayOfWeekMonthly: task.recurrenceDayOfWeekMonthly,
            recurrenceMonth: task.recurrenceMonth,
            project: task.project ? (task.project as any).documentId : null,
            // Copy all additional fields
            soon: task.soon,
            long: task.long,
            trackingUrl: task.trackingUrl,
            purchaseUrl: task.purchaseUrl,
            price: task.price,
            wishListCategory: task.wishListCategory,
          },
        }),
      });

      if (createResponse.ok) {
        const newTaskData = await createResponse.json();
        newTask = newTaskData.data;
      } else {
        return NextResponse.json(
          { success: false, error: 'Failed to create next recurrence' },
          { status: createResponse.status }
        );
      }
    }

    // Delete the current task
    const deleteResponse = await fetch(
      `${STRAPI_API_URL}/api/tasks/${documentId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete task' },
        { status: deleteResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      deletedTask: task,
      newTask,
    });
  } catch (error) {
    console.error('Error skipping recurring task:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

