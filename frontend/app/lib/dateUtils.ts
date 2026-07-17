import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Date helpers, all resolved against the caller's `TimeZoneSettings`.
 *
 * Every function here takes the settings rather than reading them from a module
 * cache — see `timeZoneSettings.ts` for why that distinction is load-bearing.
 *
 * A `Date` in this module is **always a real instant**. Wall-clock values live only
 * as ISO strings (`toISODate`/`shiftISODate`) or as an hour number — never as a
 * `Date`. The single place a zoned `Date` briefly exists is inside
 * `formatInTimezone`, which reads it straight into a string and never hands it back.
 * `toZonedTime` is imported here for exactly that, and is deliberately no longer
 * re-exported: that re-export ("for convenience") was how the zoned-Date footgun
 * spread across the codebase. `getNow` is gone for the same reason.
 */

/**
 * Get today's date at midnight in the configured timezone, as a real instant.
 */
export function getToday(settings: TimeZoneSettings): Date {
  const dateStr = formatInTimezone(new Date(), 'yyyy-MM-dd', settings);
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

  // For other formats, use formatTz (may require IANA database).
  // originalDate must be the untouched instant: formatTz derives the zone offset
  // (the `xxx` token) from it, and without it the ambiguous repeated hour of
  // fall-back (01:00–01:59) renders one offset for both, writing a completedAt an
  // hour off. The library's own formatInTimeZone passes it for exactly this reason.
  return formatTz(zonedDate, formatString, { timeZone: timezone, originalDate: date });
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
 * Shift an ISO date string (YYYY-MM-DD) by whole days.
 *
 * The arithmetic runs on a UTC calendar so that no DST transition can duplicate or
 * skip a day, and so that it cannot pick up the machine's zone the way date-fns'
 * local-component helpers (addDays, setDate) would. Lives here — pure string math,
 * no imports — so `getTodayForRecurrence` can use it without a `dateUtils` ↔
 * `dayBoundaryHelpers` import cycle.
 */
export function shiftISODate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Whole-day difference (a − b) between two ISO date strings (YYYY-MM-DD).
 *
 * Runs on the UTC calendar for the same reason as shiftISODate. Positive when `a`
 * is later than `b`.
 */
export function isoDayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/**
 * Get today's date for recurrence purposes, respecting day boundary hour.
 * If the current time is before the day boundary hour, returns the previous day.
 *
 * Example: if the day boundary is 4am and it's 2am Tuesday, this returns Monday.
 *
 * Returns the boundary-hour instant of that effective day. No zoned `Date` is ever
 * materialised: the hour and date are read out as a number and a string, and the
 * result is built back up with `fromZonedTime`.
 */
export function getTodayForRecurrence(settings: TimeZoneSettings): Date {
  const { timezone, dayBoundaryHour } = settings;
  const now = new Date();

  const currentHour = Number(formatInTimezone(now, 'H', settings));
  const todayISO = formatInTimezone(now, 'yyyy-MM-dd', settings);
  const effectiveISO = currentHour < dayBoundaryHour ? shiftISODate(todayISO, -1) : todayISO;

  return fromZonedTime(
    `${effectiveISO}T${String(dayBoundaryHour).padStart(2, '0')}:00:00`,
    timezone
  );
}
