import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { getTodayForRecurrence, toISODate, parseDate, shiftISODate } from '@/app/lib/dateUtils';
import { getTimeZoneSettings } from '@/app/lib/strapiServer';
import { parseDays } from '@/app/lib/queryParams';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

interface StatItem {
  type: 'project' | 'category';
  name: string;
  count: number;
}

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

    // Get days parameter from query string (default to 7)
    const { searchParams } = new URL(req.url);
    const days = parseDays(searchParams.get('days'), 7);

    // Calculate the date range, respecting day boundary hour. Day arithmetic on
    // the ISO string (setDate on the instant ran in the machine's calendar).
    // Two forms below: a date string for the `date`-typed practice-log / work-session
    // fields (where a YYYY-MM-DD compare is correct), and a real UTC timestamp for
    // the completedAt datetime filter (a bare date there reads as UTC midnight and
    // over-includes the prior evening — R9).
    const settings = await getTimeZoneSettings(token);
    const daysAgoString = shiftISODate(toISODate(getTodayForRecurrence(settings), settings), -days);
    const daysAgoTimestamp = parseDate(daysAgoString, settings).toISOString();

    // Fetch completed tasks from the specified time range
    let allCompletedTasks: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/tasks?filters[completed][$eq]=true&filters[completedAt][$gte]=${daysAgoTimestamp}&populate[project][populate][worldRef]=true&pagination[pageSize]=100&pagination[page]=${page}`,
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
      allCompletedTasks = allCompletedTasks.concat(data.data);

      const pagination = data.meta?.pagination;
      if (pagination && page < pagination.pageCount) {
        page++;
      } else {
        hasMore = false;
      }
    }

    // Fetch all long tasks that have work sessions
    let allLongTasks: any[] = [];
    page = 1;
    hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/tasks?filters[long][$eq]=true&populate[project][populate][worldRef]=true&pagination[pageSize]=100&pagination[page]=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch long tasks' },
          { status: response.status }
        );
      }

      const data = await response.json();
      allLongTasks = allLongTasks.concat(data.data);

      const pagination = data.meta?.pagination;
      if (pagination && page < pagination.pageCount) {
        page++;
      } else {
        hasMore = false;
      }
    }

    // Fetch practice logs from the specified time range
    let allPracticeLogs: any[] = [];
    page = 1;
    hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/practice-logs?filters[date][$gte]=${daysAgoString}&pagination[pageSize]=100&pagination[page]=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch practice logs' },
          { status: response.status }
        );
      }

      const data = await response.json();
      allPracticeLogs = allPracticeLogs.concat(data.data);

      const pagination = data.meta?.pagination;
      if (pagination && page < pagination.pageCount) {
        page++;
      } else {
        hasMore = false;
      }
    }

    // Count projects and categories
    const projectCounts = new Map<string, { name: string; count: number }>();

    // Count completed tasks (excluding recurring tasks)
    for (const task of allCompletedTasks) {
      // Skip recurring tasks
      if (task.isRecurring) {
        continue;
      }

      if (task.project) {
        const projectId = task.project.documentId;
        const projectName = task.project.title;
        if (projectCounts.has(projectId)) {
          projectCounts.get(projectId)!.count++;
        } else {
          projectCounts.set(projectId, { name: projectName, count: 1 });
        }
      }
      // Skip project-less tasks
    }

    // Count work sessions from long tasks in the specified time range (excluding recurring tasks)
    for (const task of allLongTasks) {
      // Skip recurring tasks
      if (task.isRecurring) {
        continue;
      }
      
      if (task.workSessions && Array.isArray(task.workSessions)) {
        // Filter work sessions to only those in the specified time range
        const recentSessions = task.workSessions.filter((session: any) => {
          return session.date >= daysAgoString;
        });

        if (recentSessions.length > 0) {
          if (task.project) {
            const projectId = task.project.documentId;
            const projectName = task.project.title;
            if (projectCounts.has(projectId)) {
              projectCounts.get(projectId)!.count += recentSessions.length;
            } else {
              projectCounts.set(projectId, {
                name: projectName,
                count: recentSessions.length,
              });
            }
          }
          // Skip project-less tasks
        }
      }
    }

    // Count practice sessions and group by type
    let writingCount = 0;
    let practicingCount = 0;

    for (const log of allPracticeLogs) {
      // Only count completed practice sessions (those with a stop time)
      if (log.stop) {
        if (log.type === 'composing' || log.type === 'writing') {
          writingCount++;
        } else if (log.type === 'guitar' || log.type === 'voice' || log.type === 'drums' || log.type === 'ear training') {
          practicingCount++;
        }
      }
    }

    // Categories to exclude from stats

    // Combine projects and categories into a single list
    const stats: StatItem[] = [];

    for (const [projectId, data] of projectCounts.entries()) {
      stats.push({
        type: 'project',
        name: data.name,
        count: data.count,
      });
    }

    // Add practice session entries if there are any
    if (writingCount > 0) {
      stats.push({
        type: 'category',
        name: 'writing',
        count: writingCount,
      });
    }

    if (practicingCount > 0) {
      stats.push({
        type: 'category',
        name: 'practicing',
        count: practicingCount,
      });
    }

    // Sort by count (descending)
    stats.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching recent stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

