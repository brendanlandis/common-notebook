import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { AuthConfigError, SessionUnavailableError } from '@/app/lib/authErrors';

const getAccessToken = vi.fn();
vi.mock('@/app/lib/strapiAuth', () => ({
  getAccessToken: (...args: unknown[]) => getAccessToken(...args),
}));

import { GET } from './route';

const request = () => new NextRequest('http://localhost:3000/api/auth/session');

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('200s a live session', async () => {
    getAccessToken.mockResolvedValue('a-token');
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('401s when there is no live session — the one answer SessionGuard redirects on', async () => {
    getAccessToken.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
  });

  it('503s when Strapi cannot be reached to renew the session: unknown, not over', async () => {
    getAccessToken.mockRejectedValue(new SessionUnavailableError('down'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('5');
  });

  it('500s, never 401s, when tokens cannot be verified at all', async () => {
    getAccessToken.mockRejectedValue(new AuthConfigError('JWT_SECRET is not set'));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'misconfigured' });
  });

  it('500s on anything else', async () => {
    getAccessToken.mockRejectedValue(new Error('boom'));
    expect((await GET(request())).status).toBe(500);
  });
});
