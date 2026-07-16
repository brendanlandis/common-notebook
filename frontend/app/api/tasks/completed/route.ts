import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTodayForRecurrence, toISODate } from '@/app/lib/dateUtils';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export async function GET(req: NextRequest) {
  try {
    // Get auth token from cookies
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calculate the cutoff date to limit the query, respecting day boundary hour
    const settings = await getTimeZoneSettings(token);
    const daysParam = req.nextUrl.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const today = getTodayForRecurrence(settings);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = toISODate(cutoffDate, settings);

    // Fetch completed tasks from the last 30 days with their project relationship populated
    // Fetch all pages to ensure we get all tasks
    let allTasks: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/tasks?filters[completed][$eq]=true&filters[completedAt][$gte]=${cutoffDateString}&populate=project&pagination[pageSize]=100&pagination[page]=${page}&sort=completedAt:desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch completed tasks' },
          { status: response.status }
        );
      }

      const data = await response.json();
      allTasks = allTasks.concat(data.data);

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
      data: allTasks,
    });
  } catch (error) {
    console.error('Error fetching completed tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

