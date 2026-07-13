import { afterEach, describe, expect, it, vi } from 'vitest';
import { devAuthBypassEnabled, getDevCredentials } from './devAuth';

// devAuthBypassEnabled() reads process.env at call time. vi.stubEnv mutates it
// (and handles NODE_ENV, which TypeScript otherwise treats as read-only). The
// gate must be true only when ALL three conditions hold.

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The all-conditions-satisfied baseline; individual tests break one at a time. */
function enableAll() {
  vi.stubEnv('DEV_AUTH_BYPASS', 'true');
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('STRAPI_API_URL', 'http://localhost:1337');
}

describe('devAuthBypassEnabled', () => {
  it('is true only when the flag, non-prod, and localhost URL all hold', () => {
    enableAll();
    expect(devAuthBypassEnabled()).toBe(true);
  });

  it('accepts a 127.0.0.1 Strapi URL as local', () => {
    enableAll();
    vi.stubEnv('STRAPI_API_URL', 'http://127.0.0.1:1337');
    expect(devAuthBypassEnabled()).toBe(true);
  });

  it('is false when the flag is not exactly "true"', () => {
    enableAll();
    vi.stubEnv('DEV_AUTH_BYPASS', '1');
    expect(devAuthBypassEnabled()).toBe(false);
  });

  it('is false when the flag is unset', () => {
    enableAll();
    vi.stubEnv('DEV_AUTH_BYPASS', undefined);
    expect(devAuthBypassEnabled()).toBe(false);
  });

  it('is false in production even with the flag and localhost URL set', () => {
    enableAll();
    vi.stubEnv('NODE_ENV', 'production');
    expect(devAuthBypassEnabled()).toBe(false);
  });

  it('is false when STRAPI_API_URL points at a non-local host', () => {
    enableAll();
    vi.stubEnv('STRAPI_API_URL', 'https://api.commonnotebook.com');
    expect(devAuthBypassEnabled()).toBe(false);
  });

  it('is false when STRAPI_API_URL is unset', () => {
    enableAll();
    vi.stubEnv('STRAPI_API_URL', undefined);
    expect(devAuthBypassEnabled()).toBe(false);
  });

  it('is false when STRAPI_API_URL is unparseable', () => {
    enableAll();
    vi.stubEnv('STRAPI_API_URL', 'not a url');
    expect(devAuthBypassEnabled()).toBe(false);
  });
});

describe('getDevCredentials', () => {
  it('defaults to the seed_alice account', () => {
    vi.stubEnv('DEV_AUTH_USER', undefined);
    vi.stubEnv('DEV_AUTH_PASSWORD', undefined);
    expect(getDevCredentials()).toEqual({
      identifier: 'seed_alice',
      password: 'seedpassword123',
    });
  });

  it('honors overrides', () => {
    vi.stubEnv('DEV_AUTH_USER', 'seed_bob');
    vi.stubEnv('DEV_AUTH_PASSWORD', 'hunter2');
    expect(getDevCredentials()).toEqual({ identifier: 'seed_bob', password: 'hunter2' });
  });
});
