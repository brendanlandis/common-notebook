import { z } from 'zod';

/**
 * Parsers for the numeric query params the task routes accept.
 *
 * `parseInt(searchParams.get('days') ?? '7', 10)` is the shape this replaces, and it
 * has no NaN check: `?days=abc` yields NaN, `cutoff.setDate(NaN)` yields an Invalid
 * Date, and that goes on to `toISODate`. Nothing bounded it either, so `?days=99999`
 * asked Strapi for the whole table.
 *
 * These mirror `parseDayBoundaryHour` (`timeZoneSettings.ts`) and
 * `parseVisibilityMinutes` (`completedTaskVisibilityConfig.ts`): range-check, then
 * fall back to the default rather than failing the request. The callers are this
 * app's own hooks, so a bad value means a bug on our side, not a user to inform —
 * a window that silently becomes the default is friendlier than a 400 the UI has no
 * handling for.
 */

/** Widest window any of these routes will look back. */
export const MAX_DAYS = 365;

const daysSchema = z.coerce.number().int().min(1).max(MAX_DAYS);

/**
 * Read a `days` window from a query string, falling back to `fallback` on anything
 * missing, non-numeric, fractional, or out of range.
 */
export function parseDays(raw: string | null, fallback: number): number {
  const result = daysSchema.safeParse(raw ?? undefined);
  return result.success ? result.data : fallback;
}
