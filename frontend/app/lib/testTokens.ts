/**
 * Test support for session handling: tokens shaped like Strapi's, and a stand-in
 * session for route suites. Not a test file; vitest only collects `*.test.ts(x)`.
 *
 * A test that signs or verifies for real needs `// @vitest-environment node`:
 * jsdom swaps in its own `Uint8Array`, which jose's key check refuses.
 */

import { SignJWT } from 'jose';

/** The `JWT_SECRET` every test runs with; set in vitest.setup.ts. */
export const TEST_JWT_SECRET = 'vitest-only-jwt-secret-0123456789abcdef';

interface TokenOptions {
  userId?: string | number;
  type?: string;
  /** Seconds from now; negative for a token that has already expired. */
  expiresIn?: number;
  secret?: string;
  alg?: 'HS256' | 'HS512';
  claims?: Record<string, unknown>;
}

/** A token as Strapi signs one: HS256 over the secret, `{ userId, sessionId, type }`. */
export async function signToken({
  userId = '1',
  type = 'access',
  expiresIn = 30 * 60,
  secret = TEST_JWT_SECRET,
  alg = 'HS256',
  claims = {},
}: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ userId, sessionId: 'test-session', type, ...claims })
    .setProtectedHeader({ alg })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(new TextEncoder().encode(secret));
}

/** What a forger sends: the right claims, a far-off `exp`, and no signature. */
export function unsignedToken(claims: Record<string, unknown> = {}): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: '1', sessionId: 'x', type: 'access', exp, ...claims })}.`;
}

/**
 * For suites that test a route, not auth: the `auth_token` cookie's presence
 * stands in for a verified session (user 1). strapiAuth.test.ts covers the real
 * thing. Use as:
 *
 *   vi.mock('@/app/lib/strapiAuth', async (importOriginal) =>
 *     (await import('@/app/lib/testTokens')).cookieSession(await importOriginal()));
 */
export function cookieSession<T extends object>(actual: T) {
  const token = (req: any): string | null => req.cookies.get('auth_token')?.value ?? null;
  return {
    ...actual,
    getAccessToken: async (req: any) => token(req),
    getCaller: async (req: any) => {
      const value = token(req);
      return value ? { token: value, userId: '1' } : null;
    },
  };
}
