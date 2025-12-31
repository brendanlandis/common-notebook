import { NextRequest, NextResponse } from 'next/server';
import { getTodayInEST, toISODateInEST } from '@/app/lib/dateUtils';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

interface StatItem {
  type: 'project' | 'category';
  name: string;
  count: number;
}

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

    // Get days parameter from query string (default to 7)
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Calculate the date range
    const today = getTodayInEST();
    const daysAgo = new Date(today);
    daysAgo.setDate(daysAgo.getDate() - days);
    const daysAgoString = toISODateInEST(daysAgo);

    // Fetch completed todos from the specified time range
    let allCompletedTodos: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/todos?filters[completed][$eq]=true&filters[completedAt][$gte]=${daysAgoString}&pLevel=2&pagination[pageSize]=100&pagination[page]=${page}`,
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
      allCompletedTodos = allCompletedTodos.concat(data.data);

      const pagination = data.meta?.pagination;
      if (pagination && page < pagination.pageCount) {
        page++;
      } else {
        hasMore = false;
      }
    }

    // Fetch all long todos that have work sessions
    let allLongTodos: any[] = [];
    page = 1;
    hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${STRAPI_API_URL}/api/todos?filters[long][$eq]=true&pLevel=2&pagination[pageSize]=100&pagination[page]=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch long todos' },
          { status: response.status }
        );
      }

      const data = await response.json();
      allLongTodos = allLongTodos.concat(data.data);

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
    const categoryCounts = new Map<string, number>();
    let dayJobCount = 0;

    // Count completed todos (excluding recurring tasks)
    for (const todo of allCompletedTodos) {
      // Skip recurring tasks
      if (todo.isRecurring) {
        continue;
      }
      
      if (todo.project) {
        // Check if project belongs to "day job" world
        if (todo.project.world === 'day job') {
          dayJobCount++;
        } else {
          const projectId = todo.project.documentId;
          const projectName = todo.project.title;
          if (projectCounts.has(projectId)) {
            projectCounts.get(projectId)!.count++;
          } else {
            projectCounts.set(projectId, { name: projectName, count: 1 });
          }
        }
      } else if (todo.category) {
        const category = todo.category;
        // Check if category is "work chores" (day job related)
        if (category === 'work chores') {
          dayJobCount++;
        } else {
          categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        }
      }
      // Skip incidentals (no project or category)
    }

    // Count work sessions from long todos in the specified time range (excluding recurring tasks)
    for (const todo of allLongTodos) {
      // Skip recurring tasks
      if (todo.isRecurring) {
        continue;
      }
      
      if (todo.workSessions && Array.isArray(todo.workSessions)) {
        // Filter work sessions to only those in the specified time range
        const recentSessions = todo.workSessions.filter((session: any) => {
          return session.date >= daysAgoString;
        });

        if (recentSessions.length > 0) {
          if (todo.project) {
            // Check if project belongs to "day job" world
            if (todo.project.world === 'day job') {
              dayJobCount += recentSessions.length;
            } else {
              const projectId = todo.project.documentId;
              const projectName = todo.project.title;
              if (projectCounts.has(projectId)) {
                projectCounts.get(projectId)!.count += recentSessions.length;
              } else {
                projectCounts.set(projectId, {
                  name: projectName,
                  count: recentSessions.length,
                });
              }
            }
          } else if (todo.category) {
            const category = todo.category;
            // Check if category is "work chores" (day job related)
            if (category === 'work chores') {
              dayJobCount += recentSessions.length;
            } else {
              categoryCounts.set(
                category,
                (categoryCounts.get(category) || 0) + recentSessions.length
              );
            }
          }
          // Skip incidentals (no project or category)
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
    const excludedCategories = ['in the mail'];

    // Combine projects and categories into a single list
    const stats: StatItem[] = [];

    // Add day job entry if there are any
    if (dayJobCount > 0) {
      stats.push({
        type: 'project',
        name: 'day job',
        count: dayJobCount,
      });
    }

    for (const [projectId, data] of projectCounts.entries()) {
      stats.push({
        type: 'project',
        name: data.name,
        count: data.count,
      });
    }

    // Sum all category counts into a single "chores" entry
    let totalChoresCount = 0;
    for (const [category, count] of categoryCounts.entries()) {
      // Skip excluded categories
      if (!excludedCategories.includes(category)) {
        totalChoresCount += count;
      }
    }

    // Add the combined chores entry if there are any
    if (totalChoresCount > 0) {
      stats.push({
        type: 'category',
        name: 'chores',
        count: totalChoresCount,
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

