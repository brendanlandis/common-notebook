// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

let visitor = 0;
const reset = (password: string) =>
  POST(
    new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': `198.51.100.${++visitor}` },
      body: JSON.stringify({ code: 'a-reset-code', password, passwordConfirmation: password }),
    })
  );

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ error: { message: 'Incorrect code provided' } }, { status: 400 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/reset-password — password rules', () => {
  it('refuses a password under 8 characters without asking Strapi, which has no minimum', async () => {
    const res = await reset('seven77');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Password: at least 8 characters');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses one past 72 bytes too, the same as the invite form', async () => {
    expect((await reset('🎸'.repeat(19))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hands a password that passes to Strapi', async () => {
    await reset('eight888');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
