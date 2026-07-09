import { toISODateInEST, getTodayInEST, parseInEST } from './dateUtils';
import { hasNewMoonSinceDate } from './moonPhase';
import { demoteTopOfMindProjects } from './projectImportance';
import {
  fetchAllPages,
  getSystemSetting,
  strapiFetch,
  upsertSystemSetting,
} from './strapiServer';

const MOON_PHASE_SETTING = 'moonPhaseLastResetDate';

interface StrapiRow {
  documentId: string;
}

/**
 * Clear the "soon" flag on todos and demote "top of mind" projects.
 *
 * Both filters run **server-side**. The old version fetched `/api/projects` with
 * no pagination at all and filtered `importance === 'top of mind'` in JS, so with
 * `defaultLimit: 25` it could only ever reset the first 25 projects. Prod has 27.
 *
 * Everything here is idempotent: setting `soon: false` twice is the same as once.
 * That is what makes retrying safe — see `runMoonPhaseResetIfDue`.
 *
 * The caller's own token scopes every read and write to their own rows.
 */
export async function performMoonPhaseReset(token: string): Promise<{
  todosUpdated: number;
  projectsUpdated: number;
}> {
  const soonTodos = await fetchAllPages<StrapiRow>(token, '/api/todos?filters[soon][$eq]=true');

  let todosUpdated = 0;
  for (const todo of soonTodos) {
    const response = await strapiFetch(token, `/api/todos/${todo.documentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { soon: false } }),
    });
    if (response.ok) todosUpdated += 1;
    else console.error(`Moon-phase reset: failed to update todo ${todo.documentId}`);
  }

  const projectsUpdated = await demoteTopOfMindProjects(token);

  return { todosUpdated, projectsUpdated };
}

/** Record that the reset has run, so it does not run again until the next new moon. */
export async function updateMoonPhaseResetDate(token: string): Promise<void> {
  const ok = await upsertSystemSetting(token, MOON_PHASE_SETTING, {
    date: toISODateInEST(getTodayInEST()),
  });
  if (!ok) console.error('Moon-phase reset: failed to record the reset date');
}

/**
 * One reset per user at a time, per process.
 *
 * `GET /api/todos` triggers this, and a page load fires several requests at once.
 * Without a guard each would read the same stale `moonPhaseLastResetDate` and run
 * the reset concurrently.
 *
 * This is an in-process map, exactly like `api/auth/rate-limiter.ts`. Correct on
 * the single-process droplet; behind multiple instances the right fix is a
 * conditional update in the database, which Strapi does not expose.
 */
const inFlight = new Map<string, Promise<void>>();

/**
 * Run the moon-phase reset if a new moon has passed since the last one.
 *
 * The reset date is written **after** the work succeeds, not before. Writing it
 * first looks race-safe but isn't: two concurrent requests can both read the old
 * date before either writes, so claiming first buys nothing the mutex doesn't
 * already give us — and it costs correctness. A crash mid-reset would leave the
 * date claimed and the todos un-reset until the *next* new moon, roughly 29 days
 * later. Claiming afterwards means a failure simply retries on the next request,
 * which is safe precisely because the reset is idempotent.
 *
 * Never throws: a moon-phase failure must not take down the todo list.
 */
export async function runMoonPhaseResetIfDue(token: string, userKey: string): Promise<void> {
  const existing = inFlight.get(userKey);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const setting = await getSystemSetting(token, MOON_PHASE_SETTING);
      const lastResetDate = setting?.date ? parseInEST(setting.date) : null;

      if (!hasNewMoonSinceDate(lastResetDate)) return;

      await performMoonPhaseReset(token);
      await updateMoonPhaseResetDate(token);
    } catch (error) {
      console.error('Moon-phase reset failed; will retry on the next request:', error);
    }
  })().finally(() => inFlight.delete(userKey));

  inFlight.set(userKey, pending);
  return pending;
}
