// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  process.env.STRAPI_INVITE_TOKEN = 'test-invite-token';
});

import { POST } from './route';

let visitor = 0;
const redeem = (password: string) =>
  POST(
    new NextRequest('http://localhost:3000/api/auth/redeem-invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': `198.51.100.${++visitor}` },
      body: JSON.stringify({ code: 'an-invite', username: 'someone', email: 'someone@example.com', password }),
    })
  );

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ data: [] }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/redeem-invite — password rules', () => {
  // Strapi's POST /api/users accepts any non-empty password, so these hold only here.
  it.each([
    ['too short', 'seven77'],
    ['past what bcrypt reads', 'a'.repeat(73)],
  ])('refuses a password %s before looking up the invite', async (_, password) => {
    const res = await redeem(password);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^Password: /);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('goes on to the invite for a password that passes', async () => {
    await redeem('a'.repeat(72));
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/invites?filters[code][$eq]=an-invite');
  });
});
