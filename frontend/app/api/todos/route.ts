import { NextRequest, NextResponse } from 'next/server';
import { hasNewMoonSinceDate } from '@/app/lib/moonPhase';
import { parseInEST } from '@/app/lib/dateUtils';
import {
  performMoonPhaseReset,
  updateMoonPhaseResetDate,
} from '@/app/lib/moonPhaseReset';

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

    // Check if a new moon has occurred since the last reset
    try {
      const settingsResponse = await fetch(
        `${req.nextUrl.origin}/api/system-settings?title=moonPhaseLastResetDate`,
        {
          headers: {
            Cookie: req.headers.get('cookie') || '',
          },
        }
      );

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        if (settingsData.success) {
          const lastResetDateString = settingsData.date;
          let lastResetDate: Date | null = null;

          if (lastResetDateString) {
            // Handle both YYYY-MM-DD format and full ISO timestamps
            // Extract just the date part if it's a full timestamp
            const datePart = lastResetDateString.split('T')[0].split(' ')[0];
            lastResetDate = parseInEST(datePart);
          }

          // Check if a new moon has occurred since the last reset
          if (hasNewMoonSinceDate(lastResetDate)) {
            // Perform the reset
            await performMoonPhaseReset(token);

            // Update the reset date
            await updateMoonPhaseResetDate(token);
          }
        }
      }
    } catch (error) {
      // Don't fail the request if moon phase check fails
      console.error('Error checking moon phase reset:', error);
    }

    // Fetch all incomplete todos with their project relationship populated
    // Fetch all pages to ensure we get all todos
    let allTodos: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/todos?filters[completed][$eq]=false&populate=project&pagination[pageSize]=100&pagination[page]=${page}`,
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

    // Fetch recently completed todos to allow them to remain visible for the configured duration
    // This enables the "completed task visibility window" feature
    const visibilitySettingResponse = await fetch(
      `${req.nextUrl.origin}/api/system-settings?title=completedTaskVisibilityMinutes`,
      {
        headers: {
          Cookie: req.headers.get('cookie') || '',
        },
      }
    );

    let visibilityMinutes = 15; // Default
    if (visibilitySettingResponse.ok) {
      const visibilityData = await visibilitySettingResponse.json();
      if (visibilityData.success && visibilityData.value) {
        const parsed = parseInt(visibilityData.value, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          visibilityMinutes = parsed;
        }
      } else if (!visibilityData.value) {
        // Setting doesn't exist, create it with default value
        try {
          await fetch(`${req.nextUrl.origin}/api/system-settings`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Cookie: req.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              title: 'completedTaskVisibilityMinutes',
              value: '15',
            }),
          });
        } catch (e) {
          // Non-fatal error, just log it
          console.error('Failed to create completedTaskVisibilityMinutes setting:', e);
        }
      }
    }

    // Calculate the cutoff time for recently completed todos
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - visibilityMinutes * 60 * 1000);
    const cutoffISO = cutoffTime.toISOString();

    // Fetch recently completed todos
    page = 1;
    hasMore = true;
    let recentlyCompletedTodos: any[] = [];

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/todos?filters[completed][$eq]=true&filters[completedAt][$gte]=${cutoffISO}&populate=project&pagination[pageSize]=100&pagination[page]=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        // Don't fail the whole request if completed todos can't be fetched
        console.error('Failed to fetch recently completed todos');
        break;
      }

      const data = await response.json();
      recentlyCompletedTodos = recentlyCompletedTodos.concat(data.data);

      // Check if there are more pages
      const pagination = data.meta?.pagination;
      if (pagination && page < pagination.pageCount) {
        page++;
      } else {
        hasMore = false;
      }
    }

    // Combine incomplete and recently completed todos
    allTodos = allTodos.concat(recentlyCompletedTodos);

    return NextResponse.json({
      success: true,
      data: allTodos,
    });
  } catch (error) {
    console.error('Error fetching todos:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();

    const response = await fetch(`${STRAPI_API_URL}/api/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: body }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to create todo' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Error creating todo:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

