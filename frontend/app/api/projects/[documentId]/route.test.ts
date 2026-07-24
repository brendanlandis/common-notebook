import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Pins the `demoted` contract on PUT /api/projects/[documentId] — the exact
 * route behind the reported bug, where promoting a project left the previous
 * "top of mind" lit in Good Morning until a reload.
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

// Use the REAL toStrapiProjectWrite so this route test actually exercises the
// write normalizer (identity-mocking it is what let the worldRef-wipe regression
// hide). Only the response-shaping normalizeProjectWorld is stubbed.
vi.mock('@/app/lib/worldNormalize', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/worldNormalize')>(
    '@/app/lib/worldNormalize'
  );
  return { ...actual, normalizeProjectWorld: (raw: unknown) => raw };
});

import { PUT } from './route';

function request(body: unknown) {
  return { json: async () => body } as any;
}

const params = (documentId: string) => ({ params: Promise.resolve({ documentId }) });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  getAccessToken.mockResolvedValue('token');
  demoteTopOfMindProjects.mockResolvedValue([]);
  // This route calls global fetch directly rather than strapiFetch.
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { documentId: 'target', title: 'Target' } }),
  });
  global.fetch = fetchMock as any;
});

describe('PUT /api/projects/[documentId]', () => {
  it('reports the projects it demoted', async () => {
    demoteTopOfMindProjects.mockResolvedValue(['incumbent', 'other']);

    const res = await PUT(
      request({ title: 'Target', importance: 'top of mind' }),
      params('target')
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      demoted: ['incumbent', 'other'],
    });
  });

  it('spares the project being promoted', async () => {
    // Without the exception the sweep would demote the very project this
    // request is promoting.
    await PUT(request({ title: 'Target', importance: 'top of mind' }), params('target'));

    expect(demoteTopOfMindProjects).toHaveBeenCalledWith('token', 'target');
  });

  it('demotes nothing for an ordinary edit, and says so', async () => {
    // A rename must not disturb whoever holds "top of mind".
    const res = await PUT(request({ title: 'Renamed' }), params('target'));

    expect(demoteTopOfMindProjects).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ success: true, demoted: [] });
  });

  it('does not clear the world relation on an importance-only update', async () => {
    // The reported data-loss bug: a partial PUT missing `world` must NOT send
    // worldRef, or Strapi wipes the project's world.
    await PUT(request({ importance: 'top of mind' }), params('target'));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect('worldRef' in body.data).toBe(false);
    expect(body.data).toMatchObject({ importance: 'top of mind' });
  });

  it('does not clear the world relation when completing a project', async () => {
    await PUT(request({ complete: true }), params('target'));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect('worldRef' in body.data).toBe(false);
  });

  it('still sets worldRef when the caller provides a world', async () => {
    await PUT(request({ title: 'Target', world: 'w1' }), params('target'));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data).toMatchObject({ title: 'Target', worldRef: 'w1' });
    expect('world' in body.data).toBe(false);
  });

  it('never demotes for an unauthenticated caller', async () => {
    getAccessToken.mockResolvedValue(null);

    const res = await PUT(
      request({ title: 'Target', importance: 'top of mind' }),
      params('target')
    );

    expect(res.status).toBe(401);
    expect(demoteTopOfMindProjects).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
