import { describe, it, expect } from 'vitest';
import { parseDays, MAX_DAYS } from './queryParams';

/**
 * The bug being pinned: `parseInt('abc', 10)` is NaN, and NaN flowed all the way to
 * `cutoff.setDate(NaN)` → Invalid Date → `toISODate`. Every case here is one the old
 * `parseInt` shape got wrong.
 */
describe('parseDays', () => {
  it('reads a well-formed value', () => {
    expect(parseDays('14', 7)).toBe(14);
  });

  it('falls back when the param is absent', () => {
    expect(parseDays(null, 30)).toBe(30);
  });

  it('falls back on a non-numeric value rather than yielding NaN', () => {
    expect(parseDays('abc', 7)).toBe(7);
    expect(Number.isNaN(parseDays('abc', 7))).toBe(false);
  });

  it('falls back on an empty string', () => {
    expect(parseDays('', 7)).toBe(7);
  });

  it('falls back on zero and on negatives, which would move the cutoff forwards', () => {
    expect(parseDays('0', 7)).toBe(7);
    expect(parseDays('-1', 7)).toBe(7);
  });

  it('clamps nothing — an out-of-range window falls back to the default', () => {
    expect(parseDays(String(MAX_DAYS + 1), 7)).toBe(7);
    expect(parseDays('99999', 7)).toBe(7);
  });

  it('accepts the boundary values', () => {
    expect(parseDays('1', 7)).toBe(1);
    expect(parseDays(String(MAX_DAYS), 7)).toBe(MAX_DAYS);
  });

  it('falls back on a fractional value, which setDate would truncate silently', () => {
    expect(parseDays('7.5', 30)).toBe(30);
  });

  it('falls back on Infinity', () => {
    expect(parseDays('Infinity', 7)).toBe(7);
  });

  it('honours each route\'s own default', () => {
    expect(parseDays(null, 7)).toBe(7);
    expect(parseDays(null, 30)).toBe(30);
  });
});
