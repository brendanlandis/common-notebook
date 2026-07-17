import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTodayForRecurrence, toISODate } from '@/app/lib/dateUtils';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';
import { parseDays } from '@/app/lib/queryParams';

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

    // Calculate the cutoff date to filter work sessions, respecting day boundary hour
    const days = parseDays(req.nextUrl.searchParams.get('days'), 30);
    const settings = await getTimeZoneSettings(token);
    const today = getTodayForRecurrence(settings);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = toISODate(cutoffDate, settings);

    // Fetch incomplete long tasks with their project relationship populated
    // Filter for: completed=false AND long=true
    let allTasks: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/tasks?filters[completed][$eq]=false&filters[long][$eq]=true&populate=project&pagination[pageSize]=100&pagination[page]=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch tasks' },
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

    // Filter client-side for only those with work sessions from the cutoff date
    const tasksWithSessions = allTasks
      .map((task) => {
        if (!task.workSessions || task.workSessions.length === 0) {
          return null;
        }
        // Filter work sessions to only include those from the cutoff date
        const recentSessions = task.workSessions.filter(
          (session: any) => session.date >= cutoffDateString
        );
        if (recentSessions.length === 0) {
          return null;
        }
        return {
          ...task,
          workSessions: recentSessions,
        };
      })
      .filter((task) => task !== null);

    return NextResponse.json({
      success: true,
      data: tasksWithSessions,
    });
  } catch (error) {
    console.error('Error fetching long tasks with sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

