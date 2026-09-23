// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real token verification, so a forged cookie is judged the way production
// judges it. Only the cookie jar is faked.
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ set: vi.fn(), get: vi.fn() })) }));

import { NextRequest } from 'next/server';
import { signToken, unsignedToken } from '@/app/lib/testTokens';
import { GET } from './route';

const request = (authToken: string) =>
  new NextRequest('http://localhost:3000/api/shows-tasks?before=2026-09-23', {
    headers: { cookie: `auth_token=${authToken}` },
  });

describe('GET /api/shows-tasks, with verified identity', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('SHOW_TASKS_USER_ID', '1');
    // Everything the archive fetch needs, so the only thing between a caller and
    // the show history is the identity check.
    vi.stubEnv('NEXT_PUBLIC_STRAPI_BAND_API_URL', 'https://archive.example');
    vi.stubEnv('BANDNOTEBOOK_KEY', 'archive-key');
    vi.stubEnv('NEXT_PUBLIC_BAND_NOTEBOOK_USER', 'brendan');
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'a show' }] })));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('401s a forged cookie carrying the configured user id, and never touches the archive', async () => {
    // Until 2026-09-23 this returned enabled: true and the show history.
    const response = await GET(request(unsignedToken({ userId: '1' })));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401s a token for the configured id signed with another secret', async () => {
    const response = await GET(request(await signToken({ userId: '1', secret: 'not-the-backends-secret-0123' })));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is disabled for another user’s valid token', async () => {
    const body = await (await GET(request(await signToken({ userId: '2' })))).json();
    expect(body).toMatchObject({ enabled: false, shows: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is enabled, with the shows, for the configured user’s valid token', async () => {
    const body = await (await GET(request(await signToken({ userId: '1' })))).json();
    expect(body).toEqual({ success: true, enabled: true, shows: [{ id: 'a show' }] });
  });
});
