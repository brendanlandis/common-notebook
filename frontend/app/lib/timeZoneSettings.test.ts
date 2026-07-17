import { describe, it, expect } from 'vitest';
import { parseDayBoundaryHour, DEFAULT_TIME_ZONE_SETTINGS } from './timeZoneSettings';

// The default the coercion falls back to (4am). Read from the source of truth so
// this stays honest if defaultSettings.ts changes.
const DEFAULT = DEFAULT_TIME_ZONE_SETTINGS.dayBoundaryHour;

describe('parseDayBoundaryHour', () => {
  it('accepts every in-range hour, including the edges 0 and 23', () => {
    expect(parseDayBoundaryHour('0')).toBe(0);
    expect(parseDayBoundaryHour('4')).toBe(4);
    expect(parseDayBoundaryHour('23')).toBe(23);
  });

  it('falls back to the default for out-of-range hours', () => {
    expect(parseDayBoundaryHour('-1')).toBe(DEFAULT);
    expect(parseDayBoundaryHour('24')).toBe(DEFAULT);
    expect(parseDayBoundaryHour('99')).toBe(DEFAULT);
  });

  it('falls back to the default for non-numeric, empty, null, and undefined input', () => {
    expect(parseDayBoundaryHour('abc')).toBe(DEFAULT);
    expect(parseDayBoundaryHour('')).toBe(DEFAULT);
    expect(parseDayBoundaryHour(null)).toBe(DEFAULT);
    expect(parseDayBoundaryHour(undefined)).toBe(DEFAULT);
  });

  it('truncates a numeric string with trailing junk (parseInt semantics)', () => {
    // '6.9' and '6px' both parse to 6 — documenting the tolerated shape, not endorsing it.
    expect(parseDayBoundaryHour('6.9')).toBe(6);
    expect(parseDayBoundaryHour('6px')).toBe(6);
  });
});
