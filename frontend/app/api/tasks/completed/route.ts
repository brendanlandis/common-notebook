import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTodayForRecurrence, toISODate, parseDate, shiftISODate } from '@/app/lib/dateUtils';
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

    // Calculate the cutoff date to limit the query, respecting day boundary hour.
    // Day arithmetic on the ISO string (setDate on the instant ran in the machine's
    // calendar). completedAt is a datetime column, so the filter must be a real UTC
    // timestamp: Strapi reads a bare YYYY-MM-DD as UTC midnight, which for a
    // negative-offset zone pulls in the prior evening's tasks (the R9 over-inclusion).
    const settings = await getTimeZoneSettings(token);
    const days = parseDays(req.nextUrl.searchParams.get('days'), 30);
    const cutoffDate = shiftISODate(toISODate(getTodayForRecurrence(settings), settings), -days);
    const cutoffTimestamp = parseDate(cutoffDate, settings).toISOString();

    // Fetch completed tasks from the last 30 days with their project relationship populated
    // Fetch all pages to ensure we get all tasks
    let allTasks: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/tasks?filters[completed][$eq]=true&filters[completedAt][$gte]=${cutoffTimestamp}&populate=project&pagination[pageSize]=100&pagination[page]=${page}&sort=completedAt:desc`,
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

