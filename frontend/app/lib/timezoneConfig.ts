/**
 * Centralized timezone configuration
 * Fetches timezone from Strapi system settings
 */

const DEFAULT_TIMEZONE = 'America/New_York';

// Cache for the timezone value
let cachedTimezone: string | null = null;

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

