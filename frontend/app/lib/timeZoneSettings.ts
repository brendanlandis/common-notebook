import { getDefault } from './defaultSettings';

/**
 * The user's time settings, passed explicitly to every function that does date
 * logic.
 *
 * Both values are per-user `system-setting` rows. They are threaded as a
 * parameter rather than read from a module-level cache because a cache cannot be
 * primed on the server: a Node process has no localStorage and no mount effect,
 * so an ambient reader silently returns its default for every request, and two
 * modules caching the same setting drift apart. Both of those have happened here.
 *
 * Server code resolves this per-request from the caller's own token
 * (`getTimeZoneSettings` in `strapiServer.ts`) — never once per process, which would
 * hand one user's settings to the next.
 *
 * Client code receives it from `(main)/layout.tsx`, which loads it server-side
 * and passes it to `DateTimeSettingsProvider`; read it with `useDateTimeSettings()`.
 */
export type TimeZoneSettings = {
  /** IANA timezone identifier, e.g. 'America/New_York'. */
  timezone: string;
  /**
   * Hour (0-23) at which a new day starts. Activity before it counts as the
   * previous day — with a boundary of 4, something done at 2am Tuesday counts
   * as Monday.
   */
  dayBoundaryHour: number;
};

export const DEFAULT_TIME_ZONE_SETTINGS: TimeZoneSettings = {
  timezone: getDefault('timezone'),
  dayBoundaryHour: parseInt(getDefault('dayBoundaryHour'), 10),
};

/** Coerce a stored `dayBoundaryHour` value, falling back to the default. */
export function parseDayBoundaryHour(value: string | null | undefined): number {
  if (!value) return DEFAULT_TIME_ZONE_SETTINGS.dayBoundaryHour;
  const hour = parseInt(value, 10);
  if (isNaN(hour) || hour < 0 || hour > 23) return DEFAULT_TIME_ZONE_SETTINGS.dayBoundaryHour;
  return hour;
}
