/**
 * Day boundary configuration
 * Fetches day boundary hour from Strapi system settings
 * 
 * The day boundary determines when a "day" starts for recurrence purposes.
 * For example, if set to 4, then activity from midnight-3:59am counts as the previous day.
 */

const DEFAULT_DAY_BOUNDARY_HOUR = 0; // Midnight

// Cache for the day boundary hour value
let cachedDayBoundaryHour: number | null = null;

/**
 * Get the day boundary hour for the application
 * Priority: Strapi system setting > environment variable > default (0/midnight)
 * @returns Hour (0-23) when the day boundary occurs
 */
export function getDayBoundaryHour(): number {
  // Return cached value if available
  if (cachedDayBoundaryHour !== null) {
    return cachedDayBoundaryHour;
  }
  
  // Fallback to environment variable or default
  const envValue = process.env.NEXT_PUBLIC_DAY_BOUNDARY_HOUR;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
      return parsed;
    }
  }
  
  return DEFAULT_DAY_BOUNDARY_HOUR;
}

/**
 * Set the cached day boundary hour value
 * This is called after fetching from Strapi
 * @param hour - Hour (0-23) when the day boundary occurs
 */
export function setCachedDayBoundaryHour(hour: number): void {
  if (hour >= 0 && hour <= 23) {
    cachedDayBoundaryHour = hour;
  }
}

/**
 * Fetch day boundary hour from Strapi system settings
 * Creates the setting with default value if it doesn't exist
 * @returns Promise with hour number or null
 */
export async function fetchDayBoundaryHourFromStrapi(): Promise<number | null> {
  try {
    const response = await fetch('/api/system-settings?title=dayBoundaryHour');
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.value) {
      const hour = parseInt(data.value, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) {
        setCachedDayBoundaryHour(hour);
        return hour;
      }
    } else if (data.success && !data.value) {
      // Setting doesn't exist, create it with default value
      const success = await saveDayBoundaryHourToStrapi(DEFAULT_DAY_BOUNDARY_HOUR);
      if (success) {
        return DEFAULT_DAY_BOUNDARY_HOUR;
      }
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch day boundary hour from Strapi:', e);
    return null;
  }
}

/**
 * Save day boundary hour to Strapi system settings
 * @param hour - Hour (0-23) when the day boundary occurs
 * @returns Promise with success boolean
 */
export async function saveDayBoundaryHourToStrapi(hour: number): Promise<boolean> {
  if (hour < 0 || hour > 23) {
    console.error('Invalid day boundary hour:', hour);
    return false;
  }
  
  try {
    const response = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'dayBoundaryHour',
        value: hour.toString(),
      }),
    });
    
    if (response.ok) {
      setCachedDayBoundaryHour(hour);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to save day boundary hour to Strapi:', e);
    return false;
  }
}

