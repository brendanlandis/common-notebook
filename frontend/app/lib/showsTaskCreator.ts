import { toISODateInEST, getNowInEST } from './dateUtils';
import { subDays } from 'date-fns';

const SYSTEM_SETTINGS_TITLE = 'lastShowTasksCheck';

/**
 * Format date from YYYY-MM-DD to MM/DD
 */
function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
}

interface Show {
  id: number;
  documentId: string;
  date: string; // YYYY-MM-DD format
  venue: string;
  band: {
    name: string;
  };
}

interface ShowsApiResponse {
  data: Show[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

/**
 * Is this feature on for the logged-in user?
 *
 * The shows below are fetched for one hardcoded slownames username, but the tasks
 * are written into whoever is logged in — so without this gate every invited user
 * receives Brendan's band chores. The server decides, from the signed access token;
 * the browser has no trustworthy identity to offer. See app/api/shows-tasks/route.ts.
 */
async function showTasksEnabled(): Promise<boolean> {
  try {
    const response = await fetch('/api/shows-tasks');
    if (!response.ok) return false;
    const body = await response.json();
    return body.enabled === true;
  } catch {
    return false; // fail closed
  }
}

/**
 * Fetch past band shows and create tasks for them
 * @returns Object with success status and counts of tasks created
 */
export async function createTasksFromShows(): Promise<{
  success: boolean;
  tasksCreated: number;
  showsProcessed: number;
  skipped?: boolean;
  error?: string;
}> {
  try {
    // Before anything else — and before we write `lastShowTasksCheck`, which would
    // otherwise leave a stray settings row in every new user's account.
    if (!(await showTasksEnabled())) {
      return { success: true, tasksCreated: 0, showsProcessed: 0, skipped: true };
    }

    // Calculate yesterday's date in EST
    const now = getNowInEST();
    const yesterday = subDays(now, 1);
    const yesterdayStr = toISODateInEST(yesterday);
    const todayStr = toISODateInEST(now);

    // Fetch lastShowTasksCheck from system-settings
    const settingsResponse = await fetch(
      `/api/system-settings?title=${encodeURIComponent(SYSTEM_SETTINGS_TITLE)}`
    );

    if (!settingsResponse.ok) {
      console.error('Failed to fetch system settings');
      return {
        success: false,
        tasksCreated: 0,
        showsProcessed: 0,
        error: 'Failed to fetch system settings',
      };
    }

    const settingsData = await settingsResponse.json();
    
    let lastCheckDate: string;
    
    if (!settingsData.success || !settingsData.date) {
      // No lastShowTasksCheck found, create it with a date 30 days ago
      console.log('No lastShowTasksCheck found, creating initial setting');
      const thirtyDaysAgo = subDays(now, 30);
      const initialDate = toISODateInEST(thirtyDaysAgo);
      
      const createResponse = await fetch('/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: SYSTEM_SETTINGS_TITLE,
          date: initialDate,
        }),
      });

      if (!createResponse.ok) {
        console.error('Failed to create initial system setting');
        return {
          success: false,
          tasksCreated: 0,
          showsProcessed: 0,
          error: 'Failed to create initial system setting',
        };
      }

      lastCheckDate = initialDate;
    } else {
      lastCheckDate = settingsData.date;
    }

    // Check if we already ran today
    if (lastCheckDate >= todayStr) {
      console.log('Already checked for shows today, skipping');
      return {
        success: true,
        tasksCreated: 0,
        showsProcessed: 0,
      };
    }

    // Fetch shows via the server-side gate route, which holds the slownames
    // archive key and only returns shows when this user is enabled.
    const showsResponse = await fetch(
      `/api/shows-tasks?before=${encodeURIComponent(yesterdayStr)}`
    );

    if (!showsResponse.ok) {
      console.error('Failed to fetch shows from API');
      return {
        success: false,
        tasksCreated: 0,
        showsProcessed: 0,
        error: 'Failed to fetch shows from API',
      };
    }

    const showsData: ShowsApiResponse = await showsResponse.json();

    // Filter to only shows after lastCheckDate
    const newShows = (showsData.data ?? []).filter(
      (show) => show.date > lastCheckDate
    );

    console.log(`Found ${newShows.length} new shows to process`);

    const bandChoresProjectId = await getBandChoresProjectId();

    let tasksCreated = 0;

    // Create 2 tasks for each show
    for (const show of newShows) {
      const bandName = show.band.name;
      const venue = show.venue;
      const formattedDate = formatDateShort(show.date);

      // Task 1: Handle documentation
      const picsResult = await createTask({
        title: `${bandName} @ ${venue} ${formattedDate} - handle documentation`,
        description: [],
        category: null,
        soon: true,
        long: false,
        completed: false,
        completedAt: null,
        isRecurring: false,
        recurrenceType: 'none',
        dueDate: null,
        displayDate: null,
        displayDateOffset: null,
        recurrenceInterval: null,
        recurrenceDayOfWeek: null,
        recurrenceDayOfMonth: null,
        recurrenceWeekOfMonth: null,
        recurrenceDayOfWeekMonthly: null,
        recurrenceMonth: null,
        project: bandChoresProjectId,
        trackingUrl: null,
        purchaseUrl: null,
        price: null,
        wishListCategory: null,
      });

      if (picsResult) tasksCreated++;

      // Task 2: Handle money
      const moneyResult = await createTask({
        title: `${bandName} @ ${venue} ${formattedDate} - handle money`,
        description: [],
        category: null,
        soon: true,
        long: false,
        completed: false,
        completedAt: null,
        isRecurring: false,
        recurrenceType: 'none',
        dueDate: null,
        displayDate: null,
        displayDateOffset: null,
        recurrenceInterval: null,
        recurrenceDayOfWeek: null,
        recurrenceDayOfMonth: null,
        recurrenceWeekOfMonth: null,
        recurrenceDayOfWeekMonthly: null,
        recurrenceMonth: null,
        project: bandChoresProjectId,
        trackingUrl: null,
        purchaseUrl: null,
        price: null,
        wishListCategory: null,
      });

      if (moneyResult) tasksCreated++;
    }

    // Update system-settings with today's date
    const updateResponse = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: SYSTEM_SETTINGS_TITLE,
        date: todayStr,
      }),
    });

    if (!updateResponse.ok) {
      console.error('Failed to update system settings with new date');
      // Don't fail the whole operation if this fails
    }

    return {
      success: true,
      tasksCreated,
      showsProcessed: newShows.length,
    };
  } catch (error) {
    console.error('Error in createTasksFromShows:', error);
    return {
      success: false,
      tasksCreated: 0,
      showsProcessed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Look up the "band chores" project's documentId. Band-show tasks used to be
 * tagged with the `band chores` category; that category is now the "band chores"
 * project (projectType: chores). Returns null if not found, in which case the
 * tasks are created without a project (safe fallback).
 */
async function getBandChoresProjectId(): Promise<string | null> {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) return null;
    const body = await response.json();
    if (!body.success) return null;
    const project = (body.data as Array<{ documentId: string; title: string }>).find(
      (p) => p.title.trim().toLowerCase() === 'band chores'
    );
    if (!project) {
      console.warn('[shows] "band chores" project not found; tasks created without a project');
    }
    return project?.documentId ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a single task via API
 * @param taskData - Task data to create
 * @returns true if successful, false otherwise
 */
async function createTask(taskData: any): Promise<boolean> {
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      console.error('Failed to create task:', taskData.title);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error creating task:', error);
    return false;
  }
}

