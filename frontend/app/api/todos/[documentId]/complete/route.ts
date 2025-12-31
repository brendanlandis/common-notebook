import { NextRequest, NextResponse } from 'next/server';
import { calculateNextRecurrence } from '@/app/lib/recurrence';
import type { Todo } from '@/app/types/admin';
import { getISOTimestampInEST } from '@/app/lib/dateUtils';

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

    // First, get the todo to check if it's recurring
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

    // Mark the current todo as complete
    const updateResponse = await fetch(
      `${STRAPI_API_URL}/api/todos/${documentId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            completed: true,
            completedAt: getISOTimestampInEST(),
          },
        }),
      }
    );

    if (!updateResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to complete todo' },
        { status: updateResponse.status }
      );
    }

    let newTodo = null;

    // If recurring, create next instance
    if (todo.isRecurring) {
      const nextDates = calculateNextRecurrence(todo);

      if (nextDates.displayDate || nextDates.dueDate) {
        const createResponse = await fetch(`${STRAPI_API_URL}/api/todos?populate=project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: {
              title: todo.title,
              description: todo.description,
              dueDate: nextDates.dueDate,
              displayDate: nextDates.displayDate,
              displayDateOffset: todo.displayDateOffset,
              completed: false,
              completedAt: null,
              isRecurring: todo.isRecurring,
              recurrenceType: todo.recurrenceType,
              recurrenceInterval: todo.recurrenceInterval,
              recurrenceDayOfWeek: todo.recurrenceDayOfWeek,
              recurrenceDayOfMonth: todo.recurrenceDayOfMonth,
              recurrenceWeekOfMonth: todo.recurrenceWeekOfMonth,
              recurrenceDayOfWeekMonthly: todo.recurrenceDayOfWeekMonthly,
              recurrenceMonth: todo.recurrenceMonth,
              category: todo.category,
              project: todo.project ? (todo.project as any).documentId : null,
            },
          }),
        });

        if (createResponse.ok) {
          const newTodoData = await createResponse.json();
          newTodo = newTodoData.data;
        }
      }
    }

    return NextResponse.json({
      success: true,
      newTodo,
    });
  } catch (error) {
    console.error('Error completing todo:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

