/**
 * "Stuff projects" configuration.
 *
 * The four "stuff" project types (wishlist / errands / in the mail / buy stuff)
 * live in the `stuff` world. This toggle governs whether that world is shown in
 * the UI — the `stuff` view/nav entry and the stuff projects in the project
 * picker. When off, nothing is deleted; the projects and their tasks are simply
 * hidden. Defaults to on.
 *
 * Stored as a per-user `system-setting` row keyed by title `enableStuffProjects`
 * (value "true"/"false"), same pattern as autoDeclutterConfig.ts.
 */

import type { Project } from '@/app/types/index';
import { STUFF_PROJECT_TYPES } from '@/app/types/index';
import { slugify } from '@/app/lib/slugify';

const SETTING_TITLE = 'enableStuffProjects';
const DEFAULT_ENABLED = true;

/**
 * Fetch the enable-stuff-projects setting from Strapi.
 * Creates the setting with the default value if it doesn't exist.
 * @returns Promise with the boolean or null on error
 */
export async function fetchStuffProjectsEnabledFromStrapi(): Promise<boolean | null> {
  try {
    const response = await fetch(`/api/system-settings?title=${SETTING_TITLE}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.success && data.value) {
      return data.value === 'true';
    } else if (data.success && !data.value) {
      // Setting doesn't exist yet — create it with the default value
      const success = await saveStuffProjectsEnabledToStrapi(DEFAULT_ENABLED);
      if (success) return DEFAULT_ENABLED;
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch enable-stuff-projects setting from Strapi:', e);
    return null;
  }
}

/**
 * Save the enable-stuff-projects setting to Strapi.
 * @param enabled - whether stuff projects are shown
 * @returns Promise with success boolean
 */
export async function saveStuffProjectsEnabledToStrapi(enabled: boolean): Promise<boolean> {
  try {
    const response = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: SETTING_TITLE, value: String(enabled) }),
    });
    return response.ok;
  } catch (e) {
    console.error('Failed to save enable-stuff-projects setting to Strapi:', e);
    return false;
  }
}

export const STUFF_PROJECTS_DEFAULT_ENABLED = DEFAULT_ENABLED;

// Dedupe concurrent ensure calls (React strict-mode double-invokes effects, and
// the setting can load + toggle near-simultaneously). Strapi has no
// compare-and-set, so this in-flight guard is the client-side stand-in — good
// enough for one user in one tab.
let ensureInFlight: Promise<void> | null = null;

/**
 * Ensure the current user has a project for each of the four stuff project types
 * (wishlist / errands / in the mail / buy stuff). Missing ones are created in the
 * `stuff` world; existing ones are left untouched. Idempotent and safe to call
 * whenever stuff projects are enabled.
 *
 * Matches by `projectType` (the stable handle) so a renamed project still counts
 * as present. The titles it creates mirror the type names, which is also what the
 * data migration matches on — so the two never duplicate each other.
 */
export async function ensureStuffProjectsExist(): Promise<void> {
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) return;
      const body = await response.json();
      if (!body.success) return;

      const projects: Project[] = body.data;
      const existingTypes = new Set(
        projects.map((p) => p.projectType).filter(Boolean)
      );
      const missing = STUFF_PROJECT_TYPES.filter((t) => !existingTypes.has(t));

      for (const projectType of missing) {
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: projectType,
            slug: slugify(projectType),
            description: [],
            world: 'stuff',
            projectType,
            importance: 'normal',
          }),
        });
      }
    } catch (e) {
      console.error('Failed to ensure stuff projects exist:', e);
    } finally {
      ensureInFlight = null;
    }
  })();

  return ensureInFlight;
}
