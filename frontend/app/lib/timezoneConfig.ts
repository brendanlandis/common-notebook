/**
 * Centralized timezone configuration
 * Fetches timezone from Strapi system settings
 */

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_DAY_BOUNDARY_HOUR = 4; // 4 AM

// Cache for the timezone value
let cachedTimezone: string | null = null;

// Cache for the day boundary hour
let cachedDayBoundaryHour: number | null = null;

/**
 * Get the active timezone for the application
 * Priority: Strapi system setting > environment variable > default (America/New_York)
 * @returns IANA timezone identifier (e.g., 'America/New_York')
 */
export function getTimezone(): string {
  // Return cached value if available
  if (cachedTimezone) {
    return cachedTimezone;
  }
  
  // Fallback to environment variable or default
  return process.env.NEXT_PUBLIC_TIMEZONE || DEFAULT_TIMEZONE;
}

/**
 * Set the cached timezone value
 * This is called after fetching from Strapi
 * @param timezone - IANA timezone identifier
 */
export function setCachedTimezone(timezone: string): void {
  cachedTimezone = timezone;
}

/**
 * Fetch timezone from Strapi system settings
 * @returns Promise with timezone string or null
 */
export async function fetchTimezoneFromStrapi(): Promise<string | null> {
  try {
    const response = await fetch('/api/system-settings?title=timezone');
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.value) {
      setCachedTimezone(data.value);
      return data.value;
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch timezone from Strapi:', e);
    return null;
  }
}

/**
 * Save timezone to Strapi system settings
 * @param timezone - IANA timezone identifier
 * @returns Promise with success boolean
 */
export async function saveTimezoneToStrapi(timezone: string): Promise<boolean> {
  try {
    const response = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'timezone',
        value: timezone,
      }),
    });
    
    if (response.ok) {
      setCachedTimezone(timezone);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to save timezone to Strapi:', e);
    return false;
  }
}

/**
 * Get the day boundary hour for the application
 * Priority: Strapi system setting > environment variable > default (4 AM)
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
