import { NextRequest, NextResponse } from 'next/server';
import type { Todo } from '@/app/types/admin';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string; date: string }> }
) {
  try {
    const { documentId, date } = await params;
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
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

    // Get existing workSessions or initialize as empty array
    const workSessions = todo.workSessions || [];

    // Remove the work session for the specified date
    const filteredSessions = workSessions.filter(ws => ws.date !== date);

    if (filteredSessions.length === workSessions.length) {
      return NextResponse.json(
        { success: false, error: 'Work session not found for this date' },
        { status: 404 }
      );
    }

    // Update the todo with the filtered workSessions
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
            workSessions: filteredSessions,
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
    console.error('Error removing work session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

