import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getToday, toISODate, shiftISODate } from '@/app/lib/dateUtils';
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

    // Calculate tomorrow and 4 days from now in the owner's timezone.
    // Day arithmetic runs on the ISO date string via shiftISODate, never on the
    // instant: addDays/setDate on a Date do the math in the *machine's* calendar,
    // so on a UTC server serving a New York user `addDays(today, 1)` could land
    // back on today (the fall-back-week bug this replaces).
    const settings = await getTimeZoneSettings(token);
    const todayString = toISODate(getToday(settings), settings);

    const tomorrowString = shiftISODate(todayString, 1);
    const fourDaysOutString = shiftISODate(todayString, 4);

    // Fetch incomplete tasks with displayDate in the next 4 days (excluding today)
    // Fetch all pages to ensure we get all tasks
    let allTasks: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/tasks?filters[completed][$eq]=false&filters[displayDate][$gte]=${tomorrowString}&filters[displayDate][$lte]=${fourDaysOutString}&populate=project&pagination[pageSize]=100&pagination[page]=${page}&sort=displayDate:asc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch upcoming tasks' },
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

    return NextResponse.json(
      {
        success: true,
        data: allTasks,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

