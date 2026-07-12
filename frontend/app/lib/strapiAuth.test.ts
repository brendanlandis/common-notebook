import { describe, expect, it, vi } from 'vitest';

// `next/headers` is only reachable inside a request scope; strapiAuth guards its
// use, but the import must still resolve under vitest.
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { isExpiringSoon } from './strapiAuth';

/** Build an unsigned JWT with the given `exp`. Only the payload is ever read. */
function tokenExpiringAt(epochSeconds: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: epochSeconds, type: 'access' })}.sig`;
}

const NOW = 1_800_000_000_000; // ms
const nowSeconds = Math.floor(NOW / 1000);

describe('isExpiringSoon', () => {
  it('is false for a token with plenty of life left', () => {
    expect(isExpiringSoon(tokenExpiringAt(nowSeconds + 30 * 60), NOW)).toBe(false);
  });

  it('is true once the token is inside the 60s skew window', () => {
    expect(isExpiringSoon(tokenExpiringAt(nowSeconds + 59), NOW)).toBe(true);
  });

  it('is false just outside the skew window', () => {
    expect(isExpiringSoon(tokenExpiringAt(nowSeconds + 61), NOW)).toBe(false);
  });

  it('is true for an already-expired token', () => {
    expect(isExpiringSoon(tokenExpiringAt(nowSeconds - 1), NOW)).toBe(true);
  });

  it('is false for a token whose exp cannot be read', () => {
    // Route-handler tests pass opaque strings like `test-token`. Refreshing on
    // those would fire a network call in unit tests; instead we let Strapi judge.
    expect(isExpiringSoon('test-token', NOW)).toBe(false);
    expect(isExpiringSoon('a.b.c', NOW)).toBe(false);
    expect(isExpiringSoon('', NOW)).toBe(false);
  });

  it('is false when the payload has no exp claim', () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect(isExpiringSoon(`${b64({ alg: 'HS256' })}.${b64({ sub: 'x' })}.sig`, NOW)).toBe(false);
  });

  it('handles base64url payloads containing - and _', () => {
    // A payload that base64url-encodes with substitution characters must still parse.
    const token = tokenExpiringAt(nowSeconds + 3600);
    expect(() => isExpiringSoon(token, NOW)).not.toThrow();
  });
});
