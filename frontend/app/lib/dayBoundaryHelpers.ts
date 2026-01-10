import { toISODateInEST, toZonedTime } from './dateUtils';
import { getTimezone, getDayBoundaryHour } from './timezoneConfig';

/**
 * Get the "effective day" for a timestamp considering day boundary hour
 * Returns ISO date string (YYYY-MM-DD) of the effective day
 */
export function getEffectiveDayForTimestamp(
  timestamp: Date,
  dayBoundaryHour: number
): string {
  const zonedTime = toZonedTime(timestamp, getTimezone());
  const adjustedDate = new Date(zonedTime);
  
  // After toZonedTime, the date is timezone-adjusted
  // We use getUTCHours() because toZonedTime returns a shifted timestamp
  // where UTC components represent the target timezone values
  if (adjustedDate.getUTCHours() < dayBoundaryHour) {
    adjustedDate.setUTCDate(adjustedDate.getUTCDate() - 1);
  }
  
  return toISODateInEST(adjustedDate);
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
  dayBoundaryHour: number
): 1 | 2 | 3 {
  const sessionTime = new Date(workSessionTimestamp);
  const minutesSinceSession = (now.getTime() - sessionTime.getTime()) / (1000 * 60);
  
  const sessionDay = getEffectiveDayForTimestamp(sessionTime, dayBoundaryHour);
  const currentDay = getEffectiveDayForTimestamp(now, dayBoundaryHour);
  
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
