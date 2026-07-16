import { toISODate, toZonedTime } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Get the "effective day" for a timestamp considering day boundary hour
 * Returns ISO date string (YYYY-MM-DD) of the effective day
 */
export function getEffectiveDayForTimestamp(
  timestamp: Date,
  settings: TimeZoneSettings
): string {
  // `timestamp` is a real instant. toZonedTime returns a Date whose *local*
  // components carry the wall clock in settings.timezone — that is date-fns-tz's
  // contract, and it is why the hour is read with getHours() and not getUTCHours().
  // The two agree only on a machine that itself runs UTC, so the old reading put the
  // boundary at the wrong hour for every other machine (five hours out in New York),
  // while looking perfect on CI. Every test here pinned timezone:'UTC', which is
  // exactly the one zone where the mistake is invisible.
  const zoned = toZonedTime(timestamp, settings.timezone);

  // toISODate takes the real instant, not `zoned`: it converts to the timezone
  // itself, and handing it an already-zoned value converted a second time.
  const calendarDay = toISODate(timestamp, settings);

  if (zoned.getHours() >= settings.dayBoundaryHour) {
    return calendarDay;
  }

  // Before the boundary, the timestamp still belongs to the previous day. Step back
  // over a UTC calendar so that no DST transition can duplicate or skip the hour.
  const [year, month, day] = calendarDay.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

/**
 * Check if we're in Phase 1, 2, or 3 for a worked-on task
 *
 * Phase 1: Within visibility window, same effective day
 * Phase 2: Beyond visibility window, same effective day
 * Phase 3: Different effective day
 */
export function getWorkedOnPhase(
  workSessionTimestamp: string,
  now: Date,
  visibilityMinutes: number,
  settings: TimeZoneSettings
): 1 | 2 | 3 {
  const sessionTime = new Date(workSessionTimestamp);
  const minutesSinceSession = (now.getTime() - sessionTime.getTime()) / (1000 * 60);

  const sessionDay = getEffectiveDayForTimestamp(sessionTime, settings);
  const currentDay = getEffectiveDayForTimestamp(now, settings);

  // Phase 3: Different effective day
  if (sessionDay !== currentDay) {
    return 3;
  }

  // Same effective day - check visibility window
  if (minutesSinceSession <= visibilityMinutes) {
    return 1; // Phase 1: Within visibility window
  }

  return 2; // Phase 2: Beyond visibility window but same day
}
