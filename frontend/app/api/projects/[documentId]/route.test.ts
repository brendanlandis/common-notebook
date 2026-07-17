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

vi.mock('@/app/lib/worldNormalize', () => ({
  normalizeProjectWorld: (raw: unknown) => raw,
  toStrapiProjectWrite: (body: unknown) => body,
}));

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
