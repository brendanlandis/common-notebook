// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

let visitor = 0;
/** A different visitor each call, so the per-address limit stays out of the way. */
const askForReset = (email: string) => {
  const address = `198.51.100.${++visitor % 250}`;
  return POST(
    new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': address, 'x-forwarded-for': address },
      body: JSON.stringify({ email }),
    })
  );
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/forgot-password — per-address limit', () => {
  it('sends one inbox at most 3 reset emails an hour, however many visitors ask', async () => {
    for (let i = 0; i < 3; i++) expect((await askForReset('victim@example.com')).status).toBe(200);
    const refused = await askForReset(' Victim@Example.com ');
    expect(refused.status).toBe(429);
    expect((await refused.json()).error).toMatch(/this address/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('counts an address with no account the same way, so a refusal reveals nothing', async () => {
    for (let i = 0; i < 3; i++) await askForReset('nobody@example.com');
    expect((await askForReset('nobody@example.com')).status).toBe(429);
    expect((await askForReset('someone-else@example.com')).status).toBe(200);
  });
});
