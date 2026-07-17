import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Pins the `demoted` contract on POST /api/projects.
 *
 * Creating a project as "top of mind" demotes the incumbent server-side, in a
 * request that names only the new project. Nothing else tells the browser those
 * rows changed, so `demoted` is the whole mechanism — worth a test of its own
 * rather than only being covered through the e2e.
 *
 * These are among the first API route tests here, so they stay deliberately
 * narrow: the response shape and when the demotion fires, not Strapi's
 * behaviour.
 */

const getAccessToken = vi.fn();
vi.mock('@/app/lib/strapiAuth', () => ({
  getAccessToken: (...a: unknown[]) => getAccessToken(...a),
}));

const demoteTopOfMindProjects = vi.fn();
vi.mock('@/app/lib/projectImportance', () => ({
  TOP_OF_MIND: 'top of mind',
  demoteTopOfMindProjects: (...a: unknown[]) => demoteTopOfMindProjects(...a),
}));

const strapiFetch = vi.fn();
vi.mock('@/app/lib/strapiServer', () => ({
  strapiFetch: (...a: unknown[]) => strapiFetch(...a),
  fetchAllPages: vi.fn(),
}));

vi.mock('@/app/lib/worldNormalize', () => ({
  normalizeProjectWorld: (raw: unknown) => raw,
  toStrapiProjectWrite: (body: unknown) => body,
}));

import { POST } from './route';

/** A request the route can read a JSON body off. */
function request(body: unknown) {
  return { json: async () => body } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAccessToken.mockResolvedValue('token');
  demoteTopOfMindProjects.mockResolvedValue([]);
  strapiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { documentId: 'new', title: 'New' } }),
  });
});

describe('POST /api/projects', () => {
  it('reports the projects it demoted', async () => {
    demoteTopOfMindProjects.mockResolvedValue(['incumbent']);

    const res = await POST(request({ title: 'New', importance: 'top of mind' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      demoted: ['incumbent'],
    });
  });

  it('demotes nothing for an ordinary project, and says so', async () => {
    const res = await POST(request({ title: 'New', importance: 'normal' }));

    expect(demoteTopOfMindProjects).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ success: true, demoted: [] });
  });

  it('passes no exception id — the new project has no documentId yet', async () => {
    await POST(request({ title: 'New', importance: 'top of mind' }));

    expect(demoteTopOfMindProjects).toHaveBeenCalledWith('token');
  });

  it('never demotes for an unauthenticated caller', async () => {
    getAccessToken.mockResolvedValue(null);

    const res = await POST(request({ title: 'New', importance: 'top of mind' }));

    expect(res.status).toBe(401);
    expect(demoteTopOfMindProjects).not.toHaveBeenCalled();
    expect(strapiFetch).not.toHaveBeenCalled();
  });
});
