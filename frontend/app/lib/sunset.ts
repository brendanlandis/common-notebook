import * as Astronomy from 'astronomy-engine';
import { Temporal } from 'temporal-polyfill';
import type { Location } from './location';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * When the sun goes down, on a given calendar day, on the user's wall clock.
 *
 * The only reason this app knows where you are. It exists because "how much of
 * today is left" is a question the light answers better than the clock does —
 * which is the same instinct the whole review feature runs on, and the opposite
 * of counting hours.
 *
 * ## The zone handling, which is the whole difficulty
 *
 * `SearchRiseSet` takes and returns **real instants**, and it must: sunset is an
 * event in the sky, and handing the ephemeris a wall-clock value would move the
 * event itself. That's the same rule the moon-phase and solstice recurrences
 * follow.
 *
 * But "sunset on Thursday" is a question about the user's *calendar day*, so the
 * search has to start at the user's midnight — not the machine's, and not UTC's.
 * Starting from `new Date(isoDate)` would search from midnight UTC, which for a
 * user in New York is 8pm the evening before: the search would return *that*
 * evening's sunset and the grid would draw a line at yesterday's dusk. On a
 * laptop already in New York the same code is right, which is exactly how this
 * class of bug reaches production unseen.
 *
 * So: user's midnight → instant → ephemeris → instant → user's wall clock.
 */

/** `YYYY-MM-DDTHH:mm:ss` in the owner's zone, or null if the sun doesn't set. */
export function sunsetOn(
  isoDate: string,
  location: Location,
  { timezone }: TimeZoneSettings
): string | null {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  // Midnight where the user is, as a real instant.
  const startOfDay = new Date(
    Temporal.PlainDate.from(isoDate).toZonedDateTime(timezone).epochMilliseconds
  );

  // `direction: -1` is setting. Two days of search rather than one: a day is not
  // 24 hours across a DST change, and at high latitudes the next sunset can fall
  // outside the calendar day entirely. The result is filtered back to the day
  // asked about below.
  const found = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, startOfDay, 2);
  if (!found) return null;

  const wallClock = Temporal.Instant.fromEpochMilliseconds(found.date.getTime())
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .round({ smallestUnit: 'second' });

  // Above the Arctic circle in summer the next setting can be days away; a line
  // drawn on the wrong day is worse than no line.
  if (wallClock.toPlainDate().toString() !== isoDate) return null;

  return wallClock.toString();
}
