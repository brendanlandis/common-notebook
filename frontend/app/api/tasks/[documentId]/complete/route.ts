import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { calculateNextRecurrence } from '@/app/lib/recurrence';
import type { Task } from '@/app/types/index';
import { getISOTimestamp } from '@/app/lib/dateUtils';
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

    const settings = await getTimeZoneSettings(token);

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

    // Mark the current task as complete
    const updateResponse = await fetch(
      `${STRAPI_API_URL}/api/tasks/${documentId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            completed: true,
            completedAt: getISOTimestamp(settings),
          },
        }),
      }
    );

    if (!updateResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to complete task' },
        { status: updateResponse.status }
      );
    }

    let newTask = null;

    // If recurring, create next instance
    if (task.isRecurring) {
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
              // Copy additional fields that were previously missing
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
        }
      }
    }

    return NextResponse.json({
      success: true,
      newTask,
    });
  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

