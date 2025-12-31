import { NextRequest, NextResponse } from 'next/server';
import { calculateNextRecurrence } from '@/app/lib/recurrence';
import type { Todo } from '@/app/types/admin';

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

    // Only allow skipping for recurring todos
    if (!todo.isRecurring) {
      return NextResponse.json(
        { success: false, error: 'Todo is not recurring' },
        { status: 400 }
      );
    }

    let newTodo = null;

    // Create next instance
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
            soon: todo.soon,
            long: todo.long,
          },
        }),
      });

      if (createResponse.ok) {
        const newTodoData = await createResponse.json();
        newTodo = newTodoData.data;
      } else {
        return NextResponse.json(
          { success: false, error: 'Failed to create next recurrence' },
          { status: createResponse.status }
        );
      }
    }

    // Delete the current todo
    const deleteResponse = await fetch(
      `${STRAPI_API_URL}/api/todos/${documentId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete todo' },
        { status: deleteResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      deletedTodo: todo,
      newTodo,
    });
  } catch (error) {
    console.error('Error skipping recurring todo:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

