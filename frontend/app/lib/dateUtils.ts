import { Temporal } from 'temporal-polyfill';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Date helpers, all resolved against the caller's `TimeZoneSettings`.
 *
 * Every function here takes the settings rather than reading them from a module
 * cache — see `timeZoneSettings.ts` for why that distinction is load-bearing.
 *
 * A `Date` in this module is **always a real instant**. Wall-clock values live only
 * as ISO strings (`toISODate`/`shiftISODate`) or as an hour number — never as a
 * `Date`. Zone-aware work goes through `Temporal.ZonedDateTime`, which names its
 * timezone explicitly and exposes the wall clock as plain integer fields, so the
 * old `toZonedTime`/`getUTCHours` footgun — a `Date` whose epoch was deliberately
 * shifted so its local getters read the zone — cannot be expressed here. `date-fns`
 * and `date-fns-tz` are gone from this module; the architecture test keeps them out.
 */

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

// Intl formatters for the locale-dependent parts (weekday and month names), keyed
// by `${timezone}|${kind}`. This is a pure (zone, kind) → formatter memo, NOT a
// settings cache: it holds no user state, so it has none of the leak-across-requests
// hazard that a cached *setting* would (see timeZoneSettings.ts). en-US is fixed so
// the strings ('Thu', 'June') do not drift with the server's locale.
const intlCache = new Map<string, Intl.DateTimeFormat>();
function intl(timezone: string, kind: 'weekdayShort' | 'weekdayLong' | 'monthLong'): Intl.DateTimeFormat {
  const key = `${timezone}|${kind}`;
  let fmt = intlCache.get(key);
  if (!fmt) {
    const opts: Intl.DateTimeFormatOptions =
      kind === 'weekdayShort'
        ? { weekday: 'short', timeZone: timezone }
        : kind === 'weekdayLong'
          ? { weekday: 'long', timeZone: timezone }
          : { month: 'long', timeZone: timezone };
    fmt = new Intl.DateTimeFormat('en-US', opts);
    intlCache.set(key, fmt);
  }
  return fmt;
}

/** The instant, seen as wall-clock fields in the given zone. */
function zonedOf(date: Date, timezone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timezone);
}

/**
 * Get today's date at midnight in the configured timezone, as a real instant.
 */
export function getToday(settings: TimeZoneSettings): Date {
  const today = Temporal.Now.plainDateISO(settings.timezone);
  return new Date(today.toZonedDateTime(settings.timezone).epochMilliseconds);
}

/**
 * Parse a date string (YYYY-MM-DD) as a date at midnight in the configured timezone
 * @param dateString - ISO date string in format YYYY-MM-DD
 * @returns Date object representing midnight in the configured timezone on that date
 */
export function parseDate(dateString: string, { timezone }: TimeZoneSettings): Date {
  return new Date(Temporal.PlainDate.from(dateString).toZonedDateTime(timezone).epochMilliseconds);
}

/**
 * Format a real instant in the configured timezone.
 *
 * Only the format strings the app actually uses are supported — an unknown one
 * throws rather than silently returning something wrong. The zone-aware fields come
 * from `Temporal.ZonedDateTime`; weekday and month names come from `Intl`. The `xxx`
 * offset in the ISO-timestamp format is `ZonedDateTime.offset`, which is resolved
 * from the true instant, so the ambiguous repeated hour of fall-back renders the
 * correct offset with no special handling (this was the R5 bug's home).
 */
export function formatInTimezone(
  date: Date,
  formatString: string,
  { timezone }: TimeZoneSettings
): string {
  const z = zonedOf(date, timezone);
  switch (formatString) {
    case 'yyyy-MM-dd':
      return `${pad(z.year, 4)}-${pad(z.month)}-${pad(z.day)}`;
    case 'yyyy-MM':
      return `${pad(z.year, 4)}-${pad(z.month)}`;
    case 'H':
      return String(z.hour);
    case 'EEEE':
      return intl(timezone, 'weekdayLong').format(date);
    case 'EEE MM/d':
      return `${intl(timezone, 'weekdayShort').format(date)} ${pad(z.month)}/${z.day}`;
    case 'EEEE M/d':
      return `${intl(timezone, 'weekdayLong').format(date)} ${z.month}/${z.day}`;
    case 'MMMM yyyy':
      return `${intl(timezone, 'monthLong').format(date)} ${pad(z.year, 4)}`;
    case "yyyy-MM-dd'T'HH:mm:ss.SSSxxx":
      return `${pad(z.year, 4)}-${pad(z.month)}-${pad(z.day)}T${pad(z.hour)}:${pad(z.minute)}:${pad(z.second)}.${pad(z.millisecond, 3)}${z.offset}`;
    case 'h:mm a': {
      const ampm = z.hour < 12 ? 'AM' : 'PM';
      const h12 = z.hour % 12 === 0 ? 12 : z.hour % 12;
      return `${h12}:${pad(z.minute)} ${ampm}`;
    }
    default:
      throw new Error(`formatInTimezone: unsupported format "${formatString}"`);
  }
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
 * Pure string math over the proleptic Gregorian calendar (via `Date.UTC`, a real
 * instant, never a zoned `Date`): no DST transition can duplicate or skip a day, and
 * it cannot pick up the machine's zone. Lives here so `getTodayForRecurrence` can use
 * it without a `dateUtils` ↔ `dayBoundaryHelpers` import cycle.
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
 * Returns the boundary-hour instant of that effective day. The wall-clock hour and
 * date come straight off a `ZonedDateTime`; no epoch-shifted `Date` is ever built.
 */
export function getTodayForRecurrence(settings: TimeZoneSettings): Date {
  const { timezone, dayBoundaryHour } = settings;
  const now = Temporal.Now.zonedDateTimeISO(timezone);
  const effectiveDate =
    now.hour < dayBoundaryHour ? now.toPlainDate().subtract({ days: 1 }) : now.toPlainDate();

  return new Date(
    effectiveDate.toZonedDateTime({
      timeZone: timezone,
      plainTime: Temporal.PlainTime.from({ hour: dayBoundaryHour }),
    }).epochMilliseconds
  );
}
