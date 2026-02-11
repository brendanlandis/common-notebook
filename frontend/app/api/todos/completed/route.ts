import { NextRequest, NextResponse } from 'next/server';
import { getTodayForRecurrence, toISODateInEST } from '@/app/lib/dateUtils';

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

    // Calculate the cutoff date to limit the query, respecting day boundary hour
    const daysParam = req.nextUrl.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const today = getTodayForRecurrence();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = toISODateInEST(cutoffDate);

    // Fetch completed todos from the last 30 days with their project relationship populated
    // Fetch all pages to ensure we get all todos
    let allTodos: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/todos?filters[completed][$eq]=true&filters[completedAt][$gte]=${cutoffDateString}&pLevel=2&pagination[pageSize]=100&pagination[page]=${page}&sort=completedAt:desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch completed todos' },
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

    return NextResponse.json({
      success: true,
      data: allTodos,
    });
  } catch (error) {
    console.error('Error fetching completed todos:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

