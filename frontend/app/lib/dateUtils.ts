import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { startOfDay } from 'date-fns';
import { getTimezone } from './timezoneConfig';

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
  const estDate = toZonedTime(date, tz);
  return formatTz(estDate, formatString, { timeZone: tz });
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

