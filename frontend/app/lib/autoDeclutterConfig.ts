/**
 * Auto-declutter configuration
 * Fetches the auto-declutter toggle from Strapi system settings.
 *
 * When on (the default), the workspace auto-refreshes on every new moon —
 * clearing "soon" flags and demoting "top of mind" projects, the same as the
 * manual declutter button. The gate lives in `moonPhaseReset.ts`, which reads the
 * setting server-side from the caller's token; this module is only the read/write
 * used by the settings page UI.
 *
 * Deliberately holds no cached value: nothing reads this setting synchronously,
 * and a module-level copy of a setting is what let two callers disagree about the
 * day boundary for a year. See `timeZoneSettings.ts`.
 */

import { getDefault } from './defaultSettings';

const DEFAULT_AUTO_DECLUTTER = getDefault('autoDeclutter') === 'true';

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
      return data.value === 'true';
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
 * Save the auto-declutter setting.
 *
 * Goes to `/api/auto-declutter` rather than the generic settings endpoint:
 * switching this on also arms the declutter watermark server-side, which is what
 * makes enabling wait for the next new moon instead of decluttering on the spot.
 *
 * @param enabled - whether the new-moon auto-declutter is enabled
 * @returns Promise with success boolean
 */
export async function saveAutoDeclutterToStrapi(enabled: boolean): Promise<boolean> {
  try {
    const response = await fetch('/api/auto-declutter', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled }),
    });

    return response.ok;
  } catch (e) {
    console.error('Failed to save auto-declutter setting to Strapi:', e);
    return false;
  }
}
