import { toISODate, shiftISODate, formatInTimezone } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Get the "effective day" for a timestamp considering day boundary hour.
 * Returns the ISO date string (YYYY-MM-DD) of the effective day.
 */
export function getEffectiveDayForTimestamp(
  timestamp: Date,
  settings: TimeZoneSettings
): string {
  // `timestamp` is a real instant. Read the wall-clock hour and calendar day in the
  // user's zone straight into a number and a string — no zoned Date is materialised.
  // The old code did `toZonedTime(...).getHours()`, whose result agrees with the
  // real hour only on a machine that itself runs UTC, so the boundary landed at the
  // wrong hour for every other machine (five hours out in New York) while looking
  // perfect on CI.
  const calendarDay = toISODate(timestamp, settings);
  const hour = Number(formatInTimezone(timestamp, 'H', settings));

  if (hour >= settings.dayBoundaryHour) {
    return calendarDay;
  }

  // Before the boundary, the timestamp still belongs to the previous day.
  return shiftISODate(calendarDay, -1);
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
