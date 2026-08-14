import { describe, it, expect } from 'vitest';
import { parseLocation, serializeLocation, defaultLocation } from './location';

/**
 * The setting is a string, and a half-parsed coordinate pair points somewhere
 * real and wrong — which for the one thing this is used for means a sunset line
 * drawn at a confidently incorrect time. So every unusable value falls back to
 * the default rather than to a partial answer, and nothing here throws: a
 * settings panel that won't render because one row holds bad JSON is worse than
 * one showing the default.
 */

describe('parseLocation', () => {
  it('reads a stored pair', () => {
    expect(parseLocation('{"latitude":51.5,"longitude":-0.13}')).toEqual({
      latitude: 51.5,
      longitude: -0.13,
    });
  });

  it('falls back when there is nothing stored', () => {
    expect(parseLocation(null)).toEqual(defaultLocation());
    expect(parseLocation(undefined)).toEqual(defaultLocation());
    expect(parseLocation('')).toEqual(defaultLocation());
  });

  it('falls back on malformed JSON rather than throwing', () => {
    expect(parseLocation('{oh no')).toEqual(defaultLocation());
    expect(parseLocation('null')).toEqual(defaultLocation());
    expect(parseLocation('[51.5,-0.13]')).toEqual(defaultLocation());
  });

  it('refuses half a pair', () => {
    // A latitude without its longitude isn't a partial answer, it's a wrong one.
    expect(parseLocation('{"latitude":51.5}')).toEqual(defaultLocation());
    expect(parseLocation('{"longitude":-0.13}')).toEqual(defaultLocation());
  });

  it('refuses coordinates off the globe', () => {
    expect(parseLocation('{"latitude":200,"longitude":0}')).toEqual(defaultLocation());
    expect(parseLocation('{"latitude":0,"longitude":-500}')).toEqual(defaultLocation());
    expect(parseLocation('{"latitude":"51.5","longitude":"-0.13"}')).toEqual(defaultLocation());
  });

  it('keeps the equator and the prime meridian', () => {
    // Zero is a real coordinate, and the obvious way to write this check treats
    // it as missing.
    expect(parseLocation('{"latitude":0,"longitude":0}')).toEqual({
      latitude: 0,
      longitude: 0,
    });
  });

  it('round-trips', () => {
    const location = { latitude: -33.87, longitude: 151.21 };

    expect(parseLocation(serializeLocation(location))).toEqual(location);
  });

  it('defaults somewhere consistent with the default timezone', () => {
    // A default that disagreed with the default zone would put sunset at a
    // plausible-looking wrong time rather than an obviously wrong one.
    const { latitude, longitude } = defaultLocation();

    expect(latitude).toBeGreaterThan(40);
    expect(latitude).toBeLessThan(41);
    expect(longitude).toBeLessThan(-73);
    expect(longitude).toBeGreaterThan(-75);
  });
});
