/**
 * Completed task visibility configuration
 *
 * Determines how long completed tasks remain visible in the main list before
 * disappearing (they always remain in the "done" view).
 *
 * Deliberately holds no cached value. The window has exactly one consumer —
 * `useTasks`, filtering a list — and it reaches it from `DateTimeSettingsProvider`,
 * which `(main)/layout.tsx` fills server-side. A module cache here is what forced
 * `useTasks` to `await` a prime before its first fetch, and is the pattern that let
 * the day boundary drift; see `timeZoneSettings.ts`.
 *
 * It stays out of `TimeZoneSettings` because no date function reads it: that type
 * is the parameter threaded through the pure date math and the API routes, and its
 * membership is decided by what that math needs.
 */

import { getDefault } from './defaultSettings';

const DEFAULT_COMPLETED_TASK_VISIBILITY_MINUTES = parseInt(
  getDefault('completedTaskVisibilityMinutes'),
  10
);

/** Coerce a stored `completedTaskVisibilityMinutes` value, falling back to the default. */
export function parseVisibilityMinutes(value: string | null | undefined): number {
  if (!value) return DEFAULT_COMPLETED_TASK_VISIBILITY_MINUTES;
  const minutes = parseInt(value, 10);
  if (isNaN(minutes) || minutes < 0) return DEFAULT_COMPLETED_TASK_VISIBILITY_MINUTES;
  return minutes;
}

/**
 * Save completed task visibility duration to Strapi system settings
 * @param minutes - Minutes that completed tasks remain visible
 * @returns Promise with success boolean
 */
export async function saveVisibilityMinutesToStrapi(minutes: number): Promise<boolean> {
  if (minutes < 0) {
    console.error('Invalid visibility minutes:', minutes);
    return false;
  }

  try {
    const response = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'completedTaskVisibilityMinutes',
        value: minutes.toString(),
      }),
    });

    return response.ok;
  } catch (e) {
    console.error('Failed to save visibility minutes to Strapi:', e);
    return false;
  }
}
