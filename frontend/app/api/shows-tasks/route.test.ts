import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// The route's own logic, with the caller mocked. route.verified.test.ts runs it
// against real token verification, forged cookies included.
const getCaller = vi.fn();

vi.mock('@/app/lib/strapiAuth', () => ({
  getCaller: (...args: unknown[]) => getCaller(...args),
}));

import { GET } from './route';

const request = () => new NextRequest('http://localhost:3000/api/shows-tasks');

describe('GET /api/shows-tasks', () => {
  const original = process.env.SHOW_TASKS_USER_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    getCaller.mockResolvedValue({ token: 'a-token', userId: '1' });
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SHOW_TASKS_USER_ID;
    else process.env.SHOW_TASKS_USER_ID = original;
  });

  it('401s without a caller', async () => {
    getCaller.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
  });

  it('is enabled only for the configured user', async () => {
    process.env.SHOW_TASKS_USER_ID = '1';

    const body = await (await GET(request())).json();
    expect(body).toEqual({ success: true, enabled: true, shows: [] });
  });

  it('is disabled for every other user', async () => {
    process.env.SHOW_TASKS_USER_ID = '1';
    getCaller.mockResolvedValue({ token: 'a-token', userId: '2' });

    const body = await (await GET(request())).json();
    expect(body.enabled).toBe(false);
  });

  it('fails closed when SHOW_TASKS_USER_ID is unset — even for user 1', async () => {
    delete process.env.SHOW_TASKS_USER_ID;

    const body = await (await GET(request())).json();
    expect(body.enabled).toBe(false);
  });

  it('fails closed when SHOW_TASKS_USER_ID is empty', async () => {
    process.env.SHOW_TASKS_USER_ID = '';

    const body = await (await GET(request())).json();
    expect(body.enabled).toBe(false);
  });
});
