import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAccessToken = vi.fn();
const getUserIdFromAccessToken = vi.fn();

vi.mock('@/app/lib/strapiAuth', () => ({
  getAccessToken: (...args: unknown[]) => getAccessToken(...args),
  getUserIdFromAccessToken: (...args: unknown[]) => getUserIdFromAccessToken(...args),
}));

import { GET } from './route';

const request = () => new NextRequest('http://localhost:3000/api/shows-tasks');

describe('GET /api/shows-tasks', () => {
  const original = process.env.SHOW_TASKS_USER_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    getAccessToken.mockResolvedValue('a-token');
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SHOW_TASKS_USER_ID;
    else process.env.SHOW_TASKS_USER_ID = original;
  });

  it('401s without a token', async () => {
    getAccessToken.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
  });

  it('is enabled only for the configured user', async () => {
    process.env.SHOW_TASKS_USER_ID = '1';
    getUserIdFromAccessToken.mockReturnValue('1');

    const body = await (await GET(request())).json();
    expect(body).toEqual({ success: true, enabled: true, shows: [] });
  });

  it('is disabled for every other user', async () => {
    process.env.SHOW_TASKS_USER_ID = '1';
    getUserIdFromAccessToken.mockReturnValue('2');

    const body = await (await GET(request())).json();
    expect(body.enabled).toBe(false);
  });

  it('fails closed when SHOW_TASKS_USER_ID is unset — even for user 1', async () => {
    delete process.env.SHOW_TASKS_USER_ID;
    getUserIdFromAccessToken.mockReturnValue('1');

    const body = await (await GET(request())).json();
    expect(body.enabled).toBe(false);
  });

  it('fails closed when the token carries no user id', async () => {
    process.env.SHOW_TASKS_USER_ID = '1';
    getUserIdFromAccessToken.mockReturnValue(null);

    const body = await (await GET(request())).json();
    expect(body.enabled).toBe(false);
  });

  it('does not treat an empty SHOW_TASKS_USER_ID as a match for a null user id', async () => {
    process.env.SHOW_TASKS_USER_ID = '';
    getUserIdFromAccessToken.mockReturnValue(null);

    const body = await (await GET(request())).json();
    expect(body.enabled).toBe(false);
  });
});
