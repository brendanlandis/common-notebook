import { toISODateInEST, getNowInEST } from './dateUtils';
import { subDays } from 'date-fns';

const SLOWNAMES_API_URL = process.env.STRAPI_BAND_API_URL;
const SYSTEM_SETTINGS_TITLE = 'lastShowTodosCheck';

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
 * Fetch past band shows and create todos for them
 * @returns Object with success status and counts of todos created
 */
export async function createTodosFromShows(): Promise<{
  success: boolean;
  todosCreated: number;
  showsProcessed: number;
  error?: string;
}> {
  try {
    // Calculate yesterday's date in EST
    const now = getNowInEST();
    const yesterday = subDays(now, 1);
    const yesterdayStr = toISODateInEST(yesterday);
    const todayStr = toISODateInEST(now);

    // Fetch lastShowTodosCheck from system-settings
    const settingsResponse = await fetch(
      `/api/system-settings?title=${encodeURIComponent(SYSTEM_SETTINGS_TITLE)}`
    );

    if (!settingsResponse.ok) {
      console.error('Failed to fetch system settings');
      return {
        success: false,
        todosCreated: 0,
        showsProcessed: 0,
        error: 'Failed to fetch system settings',
      };
    }

    const settingsData = await settingsResponse.json();
    
    if (!settingsData.success || !settingsData.date) {
      console.error('No lastShowTodosCheck date found in system settings');
      return {
        success: false,
        todosCreated: 0,
        showsProcessed: 0,
        error: 'No lastShowTodosCheck date found',
      };
    }

    const lastCheckDate = settingsData.date;

    // Check if we already ran today
    if (lastCheckDate >= todayStr) {
      console.log('Already checked for shows today, skipping');
      return {
        success: true,
        todosCreated: 0,
        showsProcessed: 0,
      };
    }

    // Fetch shows from Slownames API
    const username = process.env.BAND_NOTEBOOK_USER;
    const showsUrl = `${SLOWNAMES_API_URL}?pLevel=3&sort=date:desc&filters[date][$lte]=${yesterdayStr}&filters[band][users][username][$eq]=${username}`;
    
    const showsResponse = await fetch(showsUrl);
    
    if (!showsResponse.ok) {
      console.error('Failed to fetch shows from API');
      return {
        success: false,
        todosCreated: 0,
        showsProcessed: 0,
        error: 'Failed to fetch shows from API',
      };
    }

    const showsData: ShowsApiResponse = await showsResponse.json();
    
    // Filter to only shows after lastCheckDate
    const newShows = showsData.data.filter(
      (show) => show.date > lastCheckDate
    );

    console.log(`Found ${newShows.length} new shows to process`);

    let todosCreated = 0;

    // Create 2 todos for each show
    for (const show of newShows) {
      const bandName = show.band.name;
      const venue = show.venue;
      const formattedDate = formatDateShort(show.date);

      // Todo 1: Handle documentation
      const picsResult = await createTodo({
        title: `${bandName} @ ${venue} ${formattedDate} - handle documentation`,
        description: [],
        category: 'band chores',
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
        project: null,
        trackingUrl: null,
        purchaseUrl: null,
        price: null,
        wishListCategory: null,
      });

      if (picsResult) todosCreated++;

      // Todo 2: Handle money
      const moneyResult = await createTodo({
        title: `${bandName} @ ${venue} ${formattedDate} - handle money`,
        description: [],
        category: 'band chores',
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
        project: null,
        trackingUrl: null,
        purchaseUrl: null,
        price: null,
        wishListCategory: null,
      });

      if (moneyResult) todosCreated++;
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
      todosCreated,
      showsProcessed: newShows.length,
    };
  } catch (error) {
    console.error('Error in createTodosFromShows:', error);
    return {
      success: false,
      todosCreated: 0,
      showsProcessed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a single todo via API
 * @param todoData - Todo data to create
 * @returns true if successful, false otherwise
 */
async function createTodo(todoData: any): Promise<boolean> {
  try {
    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(todoData),
    });

    if (!response.ok) {
      console.error('Failed to create todo:', todoData.title);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error creating todo:', error);
    return false;
  }
}

