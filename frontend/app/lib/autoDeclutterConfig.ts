/**
 * Auto-declutter configuration
 * Fetches the auto-declutter toggle from Strapi system settings.
 *
 * When on (the default), the workspace auto-refreshes on every new moon —
 * clearing "soon" flags and demoting "top of mind" projects, the same as the
 * manual declutter button. The gate lives in `moonPhaseReset.ts`; this module is
 * the client-side read/write used by the settings page.
 */

const DEFAULT_AUTO_DECLUTTER = true;

// Cache for the auto-declutter value
let cachedAutoDeclutter: boolean | null = null;

/**
 * Get the auto-declutter setting.
 * @returns whether the new-moon auto-declutter is enabled (defaults to true)
 */
export function getAutoDeclutter(): boolean {
  if (cachedAutoDeclutter !== null) {
    return cachedAutoDeclutter;
  }
  return DEFAULT_AUTO_DECLUTTER;
}

/**
 * Set the cached auto-declutter value. Called after fetching from Strapi.
 */
export function setCachedAutoDeclutter(enabled: boolean): void {
  cachedAutoDeclutter = enabled;
}

/**
 * Fetch the auto-declutter setting from Strapi.
 * Creates the setting with the default value if it doesn't exist.
 * @returns Promise with the boolean or null on error
 */
export async function fetchAutoDeclutterFromStrapi(): Promise<boolean | null> {
  try {
    const response = await fetch('/api/system-settings?title=autoDeclutter');
    if (!response.ok) return null;

    const data = await response.json();
    if (data.success && data.value) {
      const enabled = data.value === 'true';
      setCachedAutoDeclutter(enabled);
      return enabled;
    } else if (data.success && !data.value) {
      // Setting doesn't exist, create it with the default value
      const success = await saveAutoDeclutterToStrapi(DEFAULT_AUTO_DECLUTTER);
      if (success) {
        return DEFAULT_AUTO_DECLUTTER;
      }
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch auto-declutter setting from Strapi:', e);
    return null;
  }
}

/**
 * Save the auto-declutter setting to Strapi.
 * @param enabled - whether the new-moon auto-declutter is enabled
 * @returns Promise with success boolean
 */
export async function saveAutoDeclutterToStrapi(enabled: boolean): Promise<boolean> {
  try {
    const response = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'autoDeclutter',
        value: String(enabled),
      }),
    });

    if (response.ok) {
      setCachedAutoDeclutter(enabled);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to save auto-declutter setting to Strapi:', e);
    return false;
  }
}
