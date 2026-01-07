import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { startOfDay, subHours, addDays as addDaysFn } from 'date-fns';
import { getTimezone } from './timezoneConfig';
import { getDayBoundaryHour } from './dayBoundaryConfig';

/**
 * EST/EDT timezone constant
 * @deprecated Use getTimezone() from timezoneConfig for configurable timezone support
 * Uses America/New_York which automatically handles daylight saving time
 */
export const EST_TIMEZONE = 'America/New_York';

/**
 * Re-export toZonedTime from date-fns-tz for convenience
 */
export { toZonedTime } from 'date-fns-tz';

/**
 * Get the current date and time in the configured timezone (defaults to EST)
 */
export function getNowInEST(): Date {
  return toZonedTime(new Date(), getTimezone());
}

/**
 * Get today's date at midnight in the configured timezone (defaults to EST)
 * Properly handles timezone-aware start of day calculation
 */
export function getTodayInEST(): Date {
  const nowInEST = getNowInEST();
  // Use formatTz to get YYYY-MM-DD in configured timezone, then parse it back as midnight
  const dateStr = formatTz(nowInEST, 'yyyy-MM-dd', { timeZone: getTimezone() });
  return parseInEST(dateStr);
}

/**
 * Parse a date string (YYYY-MM-DD) as a date at midnight in the configured timezone
 * @param dateString - ISO date string in format YYYY-MM-DD
 * @returns Date object representing midnight in the configured timezone on that date
 */
export function parseInEST(dateString: string): Date {
  const tz = getTimezone();
  // Create the date string with time at midnight in the target timezone
  const dateTimeString = `${dateString}T00:00:00`;
  // Use fromZonedTime to interpret this as a date/time IN the target timezone
  // (not as a UTC date/time that needs conversion)
  return fromZonedTime(dateTimeString, tz);
}

/**
 * Format a date in the configured timezone (defaults to EST)
 * @param date - Date to format
 * @param formatString - date-fns format string
 * @returns Formatted date string in the configured timezone
 */
export function formatInEST(date: Date, formatString: string): string {
  const tz = getTimezone();
  const zonedDate = toZonedTime(date, tz);
  
  // For date-only formats (yyyy-MM-dd), use the zoned Date directly
  // This avoids IANA timezone database issues in CI environments
  if (formatString === 'yyyy-MM-dd') {
    const year = zonedDate.getFullYear();
    const month = String(zonedDate.getMonth() + 1).padStart(2, '0');
    const day = String(zonedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // For other formats, use formatTz (may require IANA database)
  return formatTz(zonedDate, formatString, { timeZone: tz });
}

/**
 * Convert a date to ISO date string (YYYY-MM-DD) in the configured timezone
 * @param date - Date to convert
 * @returns ISO date string representing the date in the configured timezone
 */
export function toISODateInEST(date: Date): string {
  return formatInEST(date, 'yyyy-MM-dd');
}

/**
 * Get current timestamp as ISO string in the configured timezone
 * @param date - Optional date to format; defaults to current time
 * @returns ISO 8601 timestamp string in the configured timezone
 */
export function getISOTimestampInEST(date?: Date): string {
  return formatInEST(date || new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
}

/**
 * Get today's date for recurrence purposes, respecting day boundary hour
 * If current time is before the day boundary hour, returns previous calendar day
 * 
 * Example: If day boundary is 4am and it's 2am Tuesday, this returns Monday
 * 
 * @returns Date object representing "today" for recurrence calculations at the boundary hour
 */
export function getTodayForRecurrence(): Date {
  const tz = getTimezone();
  const now = toZonedTime(new Date(), tz);
  const dayBoundaryHour = getDayBoundaryHour();
  
  // Get today's date string in the configured timezone
  const todayDateStr = formatTz(now, 'yyyy-MM-dd', { timeZone: tz });
  
  // Create today's date at the boundary hour in the configured timezone
  const todayAtBoundary = fromZonedTime(
    `${todayDateStr}T${String(dayBoundaryHour).padStart(2, '0')}:00:00`,
    tz
  );
  
  // Get the current hour in the configured timezone
  const currentHour = parseInt(formatTz(now, 'H', { timeZone: tz }), 10);
  
  // If we're before the day boundary, count as previous day
  if (currentHour < dayBoundaryHour) {
    // Return yesterday at the boundary hour
    return addDaysFn(todayAtBoundary, -1);
  }
  
  // After or at day boundary - return today at the boundary hour
  return todayAtBoundary;
}

/**
 * Convert a completion timestamp to the date it counts as for recurrence purposes
 * Respects the day boundary hour setting
 * 
 * @param completionTime - The actual completion timestamp
 * @returns Date string (YYYY-MM-DD) for recurrence calculations
 */
export function getCompletionDateForRecurrence(completionTime: Date): string {
  const dayBoundaryHour = getDayBoundaryHour();
  const tz = getTimezone();
  
  // Convert to the target timezone to get the local date/time
  const zonedTime = toZonedTime(completionTime, tz);
  
  // Get the hour in the target timezone by reading from the zoned Date object
  // toZonedTime returns a Date that represents the local time in the target timezone
  const completionHour = zonedTime.getHours();
  
  // If completed before day boundary, use previous calendar day
  if (completionHour < dayBoundaryHour) {
    const previousDay = addDaysFn(zonedTime, -1);
    const result = formatTz(previousDay, 'yyyy-MM-dd', { timeZone: tz });
    return result;
  }
  
  // After day boundary - use current calendar day
  const result = formatTz(zonedTime, 'yyyy-MM-dd', { timeZone: tz });
  return result;
}

