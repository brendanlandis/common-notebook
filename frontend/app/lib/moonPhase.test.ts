import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';
import { hasNewMoonSince, getMoonPhaseIconName } from './moonPhase';
import { parseDate } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Covers `hasNewMoonSince`, the astronomy half of auto-declutter, which had no
 * test at all while it decided when every account's workspace got wiped.
 *
 * Background: this function used to accept `Date | null` and answer a missing
 * watermark by searching back 30 days for a new moon. The lunar month is 29.53
 * days, so that window always contains one and the answer was always "yes" —
 * every account that had never decluttered decluttered on its next page load.
 * That branch is gone and the parameter is no longer nullable, so the bug is now
 * a type error rather than something a test can reach; the "arms instead of
 * decluttering" behaviour it turned into is pinned in `moonPhaseReset.test.ts`.
 * What *is* directly guarded here is the second bug found alongside it: a new
 * moon falling later on the current day was compared against midnight and missed,
 * so the declutter landed the day after the moon it was named for.
 *
 * Deliberately mocks **nothing**. The sibling `moonPhaseReset.test.ts` stubs
 * `hasNewMoonSince` into a `vi.fn()`, which is precisely the seam the bug lived
 * in, so only an unmocked suite can catch a regression here. Astronomy calls
 * keep the real instant (a wall-clock value would move the event itself), and
 * the clock is pinned with `vi.setSystemTime` rather than by mocking
 * `./dateUtils` — stubbing `parseDate`/`toISODate` as a pair that doesn't
 * round-trip is how `recurrence*.test.ts` and `dayBoundaryHelpers.test.ts` each
 * baked a timezone bug into their own fixtures.
 *
 * TIMEZONE-SENSITIVE: a green run in one system zone proves nothing. Run under
 * at least TZ=UTC, TZ=America/New_York and a half-hour offset like
 * TZ=Asia/Kolkata. Prod is UTC; Brendan's laptop is not.
 */

const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };
const KOLKATA: TimeZoneSettings = { timezone: 'Asia/Kolkata', dayBoundaryHour: 4 };

/**
 * Real new moons (astronomy-engine, UTC instants):
 *   2026-05-16T20:01Z  2026-06-15T02:54Z  2026-07-14T09:44Z  2026-08-12T17:37Z
 *
 * 2026-06-15T02:54Z is still June *14* in New York, so anything comparing
 * instants instead of the user's calendar day disagrees about which day it fell
 * on. That is the case that must survive a zone change.
 */

/**
 * Pin the wall clock. `getToday` reads `new Date()`, so this drives it honestly
 * without mocking `./dateUtils`.
 *
 * Noon in the *user's* zone, resolved through `fromZonedTime` rather than a
 * hardcoded offset: a literal like `-04:00` silently means the wrong day either
 * side of a DST change.
 */
function setToday(iso: string, settings: TimeZoneSettings) {
  vi.setSystemTime(fromZonedTime(`${iso}T12:00:00`, settings.timezone));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hasNewMoonSince', () => {
  it('is false when the watermark was armed today — enabling waits for the next moon', () => {
    // Enabling auto-declutter now arms the watermark to today. The next new moon
    // is 2026-08-12, so nothing is owed yet.
    //
    // The old code answered this case correctly too: the bug was never here, it
    // was that no watermark existed to pass in. The half of the fix this pins is
    // the *contract* — armed today means quiet — which `moonPhaseReset.test.ts`
    // then relies on when it asserts that enabling arms rather than declutters.
    setToday('2026-07-16', EST);
    expect(hasNewMoonSince(parseDate('2026-07-16', EST), EST)).toBe(false);
  });

  it('is false for a watermark armed the day after a new moon, until the next one', () => {
    // Armed 2026-07-15, one day past the 07-14 moon. Must stay quiet all the way
    // up to the 08-12 moon rather than firing for the one already gone.
    const watermark = parseDate('2026-07-15', EST);

    setToday('2026-07-16', EST);
    expect(hasNewMoonSince(watermark, EST)).toBe(false);

    setToday('2026-08-11', EST);
    expect(hasNewMoonSince(watermark, EST)).toBe(false);
  });

  it('is true on the day of the new moon, not the day after', () => {
    // The 2026-07-14 moon is at 09:44Z — after midnight NY. Comparing instants
    // rather than calendar days pushed the declutter to 07-15.
    const watermark = parseDate('2026-06-20', EST);

    setToday('2026-07-13', EST);
    expect(hasNewMoonSince(watermark, EST)).toBe(false);

    setToday('2026-07-14', EST);
    expect(hasNewMoonSince(watermark, EST)).toBe(true);
  });

  it('still catches up a new moon that passed while the app went unused', () => {
    // Armed in May, opened again in July: the 06-15 and 07-14 moons both passed.
    // The declutter is owed, just late. This is the behaviour the fix preserves.
    setToday('2026-07-16', EST);
    expect(hasNewMoonSince(parseDate('2026-05-17', EST), EST)).toBe(true);
  });

  it('does not re-fire for the moon that armed the watermark', () => {
    // A reset on the moon day stamps that day. Asked again the same day, and
    // every day after until the next moon, the answer must be no.
    const watermark = parseDate('2026-07-14', EST);

    setToday('2026-07-14', EST);
    expect(hasNewMoonSince(watermark, EST)).toBe(false);

    setToday('2026-07-15', EST);
    expect(hasNewMoonSince(watermark, EST)).toBe(false);
  });

  it('uses the user zone calendar day for a moon that straddles midnight', () => {
    // 2026-06-15T02:54Z is June 14 in New York and June 15 in Kolkata.
    // Each user's own calendar day decides, regardless of the machine's zone.
    setToday('2026-06-14', EST);
    expect(hasNewMoonSince(parseDate('2026-06-01', EST), EST)).toBe(true);

    setToday('2026-06-14', KOLKATA);
    expect(hasNewMoonSince(parseDate('2026-06-01', KOLKATA), KOLKATA)).toBe(false);

    setToday('2026-06-15', KOLKATA);
    expect(hasNewMoonSince(parseDate('2026-06-01', KOLKATA), KOLKATA)).toBe(true);
  });
});

describe('getMoonPhaseIconName', () => {
  // The major-phase branch reads the clock via `getPhaseTransitionToday`, not
  // the `date` argument, so these pin the clock as well as passing a date.

  it('names the new moon for the whole day it falls on', () => {
    setToday('2026-07-14', EST);
    expect(getMoonPhaseIconName(EST, parseDate('2026-07-14', EST))).toBe('WiMoonNew');
  });

  it('returns a waxing name between the new moon and the full moon', () => {
    setToday('2026-07-21', EST);
    expect(getMoonPhaseIconName(EST, parseDate('2026-07-21', EST))).toMatch(/Waxing|FirstQuarter/);
  });

  it('returns a waning name between the full moon and the next new moon', () => {
    setToday('2026-08-06', EST);
    expect(getMoonPhaseIconName(EST, parseDate('2026-08-06', EST))).toMatch(/Waning|ThirdQuarter/);
  });
});
