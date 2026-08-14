import { getDefault } from './defaultSettings';

/**
 * Where the user is, to the nearest town.
 *
 * Stored only because **sunset needs it**. Nothing else in this app has ever
 * asked where you are, and this is deliberately the least location that answers
 * the question: a latitude and a longitude typed into a settings field, not a
 * browser permission prompt, not an IP lookup, not anything that keeps watching.
 * Two decimal places is a few kilometres, which moves sunset by seconds — so
 * there is no reason to store anything more precise than the town you're in.
 *
 * One row of JSON rather than two rows, for the same reason as the review
 * cadence: it's one indivisible value, written whole, from one form. A latitude
 * saved without its longitude is not a partial answer, it's a wrong one.
 *
 * The default matches the default timezone (America/New_York). A default that
 * disagreed with the zone would put sunset at a plausible-looking wrong time,
 * which is worse than an obviously wrong one.
 */

export interface Location {
  latitude: number;
  longitude: number;
}

export const LOCATION_SETTING = 'location';

const FALLBACK: Location = { latitude: 40.71, longitude: -74.01 };

const asCoordinate = (value: unknown, limit: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
    ? value
    : null;

/**
 * Read a stored location, falling back to the default on anything unusable.
 *
 * Never throws, and never returns a half-parsed pair: a settings panel that
 * cannot render because one row holds malformed JSON is worse than one showing
 * the default, and a latitude of 200 is not a location.
 */
export function parseLocation(value: string | null | undefined): Location {
  if (!value) return { ...FALLBACK };

  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...FALLBACK };
    raw = parsed as Record<string, unknown>;
  } catch {
    return { ...FALLBACK };
  }

  const latitude = asCoordinate(raw.latitude, 90);
  const longitude = asCoordinate(raw.longitude, 180);
  // Both or neither. Half a coordinate pair points somewhere real and wrong.
  if (latitude === null || longitude === null) return { ...FALLBACK };
  return { latitude, longitude };
}

export function serializeLocation(location: Location): string {
  return JSON.stringify(location);
}

/** The location a user has before they've set one. */
export function defaultLocation(): Location {
  return parseLocation(getDefault(LOCATION_SETTING));
}
