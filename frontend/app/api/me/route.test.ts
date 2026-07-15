import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAccessToken = vi.fn();

vi.mock('@/app/lib/strapiAuth', () => ({
  getAccessToken: (...args: unknown[]) => getAccessToken(...args),
}));

import { GET } from './route';

global.fetch = vi.fn();
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

const request = () => new NextRequest('http://localhost:3000/api/me');

describe('GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessToken.mockResolvedValue('a-token');
  });

  it('401s without a token', async () => {
    getAccessToken.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
  });

  it('returns betaAccess: true when the user has the flag', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ betaAccess: true }));
    const body = await (await GET(request())).json();
    expect(body).toEqual({ success: true, betaAccess: true });
  });

  it('returns betaAccess: false when the flag is false', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ betaAccess: false }));
    const body = await (await GET(request())).json();
    expect(body.betaAccess).toBe(false);
  });

  it('returns betaAccess: false when the field is absent', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ username: 'alice' }));
    const body = await (await GET(request())).json();
    expect(body.betaAccess).toBe(false);
  });

  it('fails closed when Strapi responds non-ok', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false));
    const body = await (await GET(request())).json();
    expect(body).toEqual({ success: true, betaAccess: false });
  });

  it('fails closed when the fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const body = await (await GET(request())).json();
    expect(body).toEqual({ success: true, betaAccess: false });
  });
});
