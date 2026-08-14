import { describe, it, expect } from 'vitest';
import { sunsetOn } from './sunset';
import type { Location } from './location';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Sunset, and above all **which day's** sunset.
 *
 * The ephemeris takes real instants, so the search has to start at the user's
 * midnight. Starting from `new Date('2026-08-13')` starts at midnight *UTC*,
 * which for a New Yorker is 8pm the evening before — so the search returns the
 * previous evening's sunset and the line lands on the wrong day. On a laptop
 * already in New York that mistake is invisible, which is why this suite only
 * means anything **run across the TZ matrix**.
 */

const NYC: Location = { latitude: 40.71, longitude: -74.01 };
const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };
const KOLKATA: TimeZoneSettings = { timezone: 'Asia/Kolkata', dayBoundaryHour: 4 };

/** Minutes past midnight, for comparisons that don't care about the second. */
const minutes = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

describe('sunsetOn', () => {
  it('returns the sunset of the day asked for', () => {
    const result = sunsetOn('2026-08-13', NYC, EST)!;

    expect(result.slice(0, 10)).toBe('2026-08-13');
  });

  it('puts a New York midsummer sunset in the evening, not the small hours', () => {
    // ~8:15pm EDT mid-August. The UTC-midnight bug produced the previous
    // evening's — same clock time, wrong date — so the date assertion above is
    // the one that catches it; this pins the value itself.
    const result = sunsetOn('2026-08-13', NYC, EST)!;

    expect(minutes(result)).toBeGreaterThan(19 * 60);
    expect(minutes(result)).toBeLessThan(21 * 60);
  });

  it('is earlier in winter than in summer', () => {
    const winter = sunsetOn('2026-12-13', NYC, EST)!;
    const summer = sunsetOn('2026-06-13', NYC, EST)!;

    expect(minutes(winter)).toBeLessThan(minutes(summer));
    // And by a lot — around four hours in New York.
    expect(minutes(summer) - minutes(winter)).toBeGreaterThan(3 * 60);
  });

  it('reads the configured zone, not the machine or UTC', () => {
    // One place, two clocks. New York's dusk falls in the small hours on an
    // Indian clock, so a reader whose zone is Kolkata and whose location is New
    // York gets a wall-clock time in the small hours — the same instant,
    // described differently, which is the whole point of storing the zone.
    const est = sunsetOn('2026-08-13', NYC, EST)!;
    const kolkata = sunsetOn('2026-08-13', NYC, KOLKATA)!;

    expect(minutes(est)).toBeGreaterThan(19 * 60);
    expect(minutes(kolkata)).toBeLessThan(7 * 60);
  });

  it('crosses a DST boundary without landing on the wrong day', () => {
    // 2026-11-01 is the fall-back Sunday in the US: a 25-hour day.
    const result = sunsetOn('2026-11-01', NYC, EST)!;

    expect(result.slice(0, 10)).toBe('2026-11-01');
  });

  it('returns null where the sun does not set', () => {
    // Svalbard in June: nothing to draw, and a line on the wrong day would be
    // worse than none.
    const svalbard: Location = { latitude: 78.22, longitude: 15.63 };

    expect(sunsetOn('2026-06-21', svalbard, { timezone: 'Arctic/Longyearbyen', dayBoundaryHour: 4 })).toBeNull();
  });

  it('formats as a plain wall clock with no offset', () => {
    // The grid is told every value it gets is UTC precisely so it does no zone
    // arithmetic of its own; an offset here would be a second opinion.
    expect(sunsetOn('2026-08-13', NYC, EST)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});
