// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { signToken } from '@/app/lib/testTokens';
import { POST } from './route';

let visitor = 0;
/** A different visitor each call unless one is named: the per-address limit stays out of the way. */
const login = (identifier: string, address = `198.51.100.${++visitor % 250}`) =>
  POST(
    new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': address, 'x-forwarded-for': address },
      body: JSON.stringify({ identifier, password: 'a guess' }),
    })
  );

/** Strapi's /api/auth/local, answering each call with the next status in line (then the last). */
function strapi(...statuses: number[]) {
  const fetchMock = vi.fn(async () => {
    const status = statuses.length > 1 ? statuses.shift()! : statuses[0];
    if (status === 200) {
      return Response.json({ jwt: await signToken(), refreshToken: 'r1', user: { id: 1 } });
    }
    return Response.json({ error: { status, message: status === 429 ? 'Too many requests' : 'Invalid identifier or password' } }, { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Unique per test, since the limiter's buckets outlive a test. */
let accounts = 0;
const newAccount = () => `someone-${++accounts}`;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/auth/login — per-account limit', () => {
  it('stops an account after 10 failed logins, whichever addresses they came from', async () => {
    const account = newAccount();
    const fetchMock = strapi(400);
    for (let i = 0; i < 10; i++) {
      expect((await login(account)).status, `attempt ${i + 1}`).toBe(401);
    }
    const refused = await login(account);
    expect(refused.status).toBe(429);
    expect((await refused.json()).error).toMatch(/this account/);
    // Strapi isn't asked again.
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("doesn't tell accounts apart by case or spacing", async () => {
    const account = newAccount();
    strapi(400);
    for (let i = 0; i < 10; i++) await login(i % 2 ? ` ${account.toUpperCase()} ` : account);
    expect((await login(account.toUpperCase())).status).toBe(429);
  });

  it("leaves other accounts alone", async () => {
    const locked = newAccount();
    strapi(400);
    for (let i = 0; i < 10; i++) await login(locked);
    expect((await login(newAccount())).status).toBe(401);
  });

  it("clears an account's failures when it logs in", async () => {
    const account = newAccount();
    strapi(400, 400, 400, 400, 400, 400, 400, 400, 400, 200, 400);
    for (let i = 0; i < 9; i++) await login(account);
    expect((await login(account)).status).toBe(200);
    expect((await login(account)).status).toBe(401);
  });

  it("passes Strapi's own limit through as a 429, without counting it against the account", async () => {
    const account = newAccount();
    strapi(...Array(12).fill(429), 400);
    for (let i = 0; i < 12; i++) expect((await login(account)).status).toBe(429);
    expect((await login(account)).status).toBe(401);
  });
});

describe('POST /api/auth/login — per-address limit', () => {
  it('stops one visitor after 5 attempts, whatever accounts they try', async () => {
    strapi(400);
    const address = '203.0.113.9';
    for (let i = 0; i < 5; i++) expect((await login(newAccount(), address)).status).toBe(401);
    expect((await login(newAccount(), address)).status).toBe(429);
  });
});
