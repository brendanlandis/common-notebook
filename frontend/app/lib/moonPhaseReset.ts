import { toISODate, getToday, parseDate } from './dateUtils';
import { hasNewMoonSince } from './moonPhase';
import { demoteTopOfMindProjects } from './projectImportance';
import {
  fetchAllPages,
  getSystemSetting,
  getTimeZoneSettings,
  strapiFetch,
  upsertSystemSetting,
} from './strapiServer';

/**
 * The declutter **watermark**: the day from which we watch for the next new moon.
 *
 * The stored title still says "last reset date" because renaming the key would
 * strand every existing row — each account would read as never-armed and lose a
 * cycle of catch-up. The name is historical; the meaning is the watermark.
 */
const MOON_PHASE_SETTING = 'moonPhaseLastResetDate';
const AUTO_DECLUTTER_SETTING = 'autoDeclutter';

interface StrapiRow {
  documentId: string;
}

/**
 * Clear the "soon" flag on tasks and demote "top of mind" projects.
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
  tasksUpdated: number;
  projectsUpdated: number;
}> {
  const soonTasks = await fetchAllPages<StrapiRow>(token, '/api/tasks?filters[soon][$eq]=true');

  let tasksUpdated = 0;
  for (const task of soonTasks) {
    const response = await strapiFetch(token, `/api/tasks/${task.documentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { soon: false } }),
    });
    if (response.ok) tasksUpdated += 1;
    else console.error(`Moon-phase reset: failed to update task ${task.documentId}`);
  }

  const projectsUpdated = await demoteTopOfMindProjects(token);

  return { tasksUpdated, projectsUpdated };
}

/**
 * Start the clock: watch for a new moon from today onwards.
 *
 * Three events mean exactly this, so they share one function — a reset has just
 * run, auto-declutter has just been switched on, or we have just met an account
 * that has no watermark at all. In every case the next declutter is the next new
 * moon, never this instant.
 */
export async function armDeclutter(token: string): Promise<void> {
  const settings = await getTimeZoneSettings(token);
  const ok = await upsertSystemSetting(token, MOON_PHASE_SETTING, {
    date: toISODate(getToday(settings), settings),
  });
  if (!ok) console.error('Moon-phase reset: failed to record the watermark');
}

/**
 * Write the auto-declutter toggle, arming the clock when it is switched on.
 *
 * Arming here is what makes "enable" mean "wait for the next new moon" instead
 * of "declutter now": without it the watermark is left missing or months stale,
 * and a stale watermark reads as a moon already owed.
 *
 * Only a real `false → true` transition arms. Stamping on every enable-save
 * would let a repeated save walk the watermark forward and postpone the
 * declutter indefinitely.
 */
export async function setAutoDeclutter(token: string, enabled: boolean): Promise<boolean> {
  const previous = await getSystemSetting(token, AUTO_DECLUTTER_SETTING);
  const wasEnabled = previous?.value !== 'false'; // opt-out: unset counts as on

  const ok = await upsertSystemSetting(token, AUTO_DECLUTTER_SETTING, {
    value: String(enabled),
  });
  if (!ok) return false;

  if (enabled && !wasEnabled) await armDeclutter(token);
  return true;
}

/**
 * One reset per user at a time, per process.
 *
 * `GET /api/tasks` triggers this, and a page load fires several requests at once.
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
 * date claimed and the tasks un-reset until the *next* new moon, roughly 29 days
 * later. Claiming afterwards means a failure simply retries on the next request,
 * which is safe precisely because the reset is idempotent.
 *
 * Never throws: a moon-phase failure must not take down the task list.
 */
export async function runMoonPhaseResetIfDue(token: string, userKey: string): Promise<void> {
  const existing = inFlight.get(userKey);
  if (existing) return existing;

  const pending = (async () => {
    try {
      // Auto-declutter is opt-out: defaults on, so unset or 'true' proceeds and
      // only an explicit 'false' skips the automatic reset. The manual declutter
      // button (/api/reset-moon-phase) is unaffected. Read first to short-circuit
      // a disabled account before touching the last-reset date.
      const auto = await getSystemSetting(token, AUTO_DECLUTTER_SETTING);
      if (auto?.value === 'false') return;

      const settings = await getTimeZoneSettings(token);
      const setting = await getSystemSetting(token, MOON_PHASE_SETTING);

      // Never armed — a fresh account, or one that predates the watermark.
      // Start the clock and declutter nothing: the first declutter is the next
      // new moon. Answering a missing watermark by looking backwards is what
      // used to wipe a new account's "soon" flags on its very first page load.
      if (!setting?.date) {
        await armDeclutter(token);
        return;
      }

      if (!hasNewMoonSince(parseDate(setting.date, settings), settings)) return;

      await performMoonPhaseReset(token);
      await armDeclutter(token);
    } catch (error) {
      console.error('Moon-phase reset failed; will retry on the next request:', error);
    }
  })().finally(() => inFlight.delete(userKey));

  inFlight.set(userKey, pending);
  return pending;
}
