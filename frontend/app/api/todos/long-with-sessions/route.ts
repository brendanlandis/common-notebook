import { NextRequest, NextResponse } from 'next/server';
import { getTodayInEST, toISODateInEST } from '@/app/lib/dateUtils';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export async function GET(req: NextRequest) {
  try {
    // Get auth token from cookies
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calculate the date 30 days ago to filter work sessions
    const today = getTodayInEST();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoString = toISODateInEST(thirtyDaysAgo);

    // Fetch incomplete long todos with their project relationship populated
    // Filter for: completed=false AND long=true
    let allTodos: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/todos?filters[completed][$eq]=false&filters[long][$eq]=true&populate=project&pagination[pageSize]=100&pagination[page]=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch todos' },
          { status: response.status }
        );
      }

      const data = await response.json();
      allTodos = allTodos.concat(data.data);

      // Check if there are more pages
      const pagination = data.meta?.pagination;
      if (pagination && page < pagination.pageCount) {
        page++;
      } else {
        hasMore = false;
      }
    }

    // Filter client-side for only those with work sessions from the last 30 days
    const todosWithSessions = allTodos
      .map((todo) => {
        if (!todo.workSessions || todo.workSessions.length === 0) {
          return null;
        }
        // Filter work sessions to only include those from the last 30 days
        const recentSessions = todo.workSessions.filter(
          (session: any) => session.date >= thirtyDaysAgoString
        );
        if (recentSessions.length === 0) {
          return null;
        }
        return {
          ...todo,
          workSessions: recentSessions,
        };
      })
      .filter((todo) => todo !== null);

    return NextResponse.json({
      success: true,
      data: todosWithSessions,
    });
  } catch (error) {
    console.error('Error fetching long todos with sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

