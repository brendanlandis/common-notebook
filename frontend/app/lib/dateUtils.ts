import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { addDays as addDaysFn } from 'date-fns';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Date helpers, all resolved against the caller's `TimeZoneSettings`.
 *
 * Every function here takes the settings rather than reading them from a module
 * cache — see `timeZoneSettings.ts` for why that distinction is load-bearing.
 */

/**
 * Re-export toZonedTime from date-fns-tz for convenience
 */
export { toZonedTime } from 'date-fns-tz';

/**
 * Get the current date and time in the configured timezone
 */
export function getNow({ timezone }: TimeZoneSettings): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Get today's date at midnight in the configured timezone
 * Properly handles timezone-aware start of day calculation
 */
export function getToday(settings: TimeZoneSettings): Date {
  const now = getNow(settings);
  // Use formatTz to get YYYY-MM-DD in configured timezone, then parse it back as midnight
  const dateStr = formatTz(now, 'yyyy-MM-dd', { timeZone: settings.timezone });
  return parseDate(dateStr, settings);
}

/**
 * Parse a date string (YYYY-MM-DD) as a date at midnight in the configured timezone
 * @param dateString - ISO date string in format YYYY-MM-DD
 * @returns Date object representing midnight in the configured timezone on that date
 */
export function parseDate(dateString: string, { timezone }: TimeZoneSettings): Date {
  // Create the date string with time at midnight in the target timezone
  const dateTimeString = `${dateString}T00:00:00`;
  // Use fromZonedTime to interpret this as a date/time IN the target timezone
  // (not as a UTC date/time that needs conversion)
  return fromZonedTime(dateTimeString, timezone);
}

/**
 * Format a date in the configured timezone
 * @param date - Date to format
 * @param formatString - date-fns format string
 * @returns Formatted date string in the configured timezone
 */
export function formatInTimezone(
  date: Date,
  formatString: string,
  { timezone }: TimeZoneSettings
): string {
  const zonedDate = toZonedTime(date, timezone);

  // For date-only formats (yyyy-MM-dd), use the zoned Date directly
  // This avoids IANA timezone database issues in CI environments
  if (formatString === 'yyyy-MM-dd') {
    const year = zonedDate.getFullYear();
    const month = String(zonedDate.getMonth() + 1).padStart(2, '0');
    const day = String(zonedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // For other formats, use formatTz (may require IANA database)
  return formatTz(zonedDate, formatString, { timeZone: timezone });
}

/**
 * Convert a date to ISO date string (YYYY-MM-DD) in the configured timezone
 * @param date - Date to convert
 * @returns ISO date string representing the date in the configured timezone
 */
export function toISODate(date: Date, settings: TimeZoneSettings): string {
  return formatInTimezone(date, 'yyyy-MM-dd', settings);
}

/**
 * Get current timestamp as ISO string in the configured timezone
 * @param date - Optional date to format; defaults to current time
 * @returns ISO 8601 timestamp string in the configured timezone
 */
export function getISOTimestamp(settings: TimeZoneSettings, date?: Date): string {
  return formatInTimezone(date || new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", settings);
}

/**
 * Get today's date for recurrence purposes, respecting day boundary hour
 * If current time is before the day boundary hour, returns previous calendar day
 *
 * Example: If day boundary is 4am and it's 2am Tuesday, this returns Monday
 *
 * @returns Date object representing "today" for recurrence calculations at the boundary hour
 */
export function getTodayForRecurrence({ timezone, dayBoundaryHour }: TimeZoneSettings): Date {
  const now = toZonedTime(new Date(), timezone);

  // Get today's date string in the configured timezone
  const todayDateStr = formatTz(now, 'yyyy-MM-dd', { timeZone: timezone });

  // Create today's date at the boundary hour in the configured timezone
  const todayAtBoundary = fromZonedTime(
    `${todayDateStr}T${String(dayBoundaryHour).padStart(2, '0')}:00:00`,
    timezone
  );

  // Get the current hour in the configured timezone
  const currentHour = parseInt(formatTz(now, 'H', { timeZone: timezone }), 10);

  // If we're before the day boundary, count as previous day
  if (currentHour < dayBoundaryHour) {
    // Return yesterday at the boundary hour
    return addDaysFn(todayAtBoundary, -1);
  }

  // After or at day boundary - return today at the boundary hour
  return todayAtBoundary;
}
