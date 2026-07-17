import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * `projectImportance.ts` had no test file, despite owning the "only one project
 * is top of mind" invariant and being the thing that silently rewrites rows the
 * browser never asked about. Its only appearance in the suite was as a
 * `vi.fn()` in `moonPhaseReset.test.ts`, which asserts that it was *called* and
 * can say nothing about what it does — which is how the demotions stayed
 * invisible to the client for as long as they did.
 */

const fetchAllPages = vi.fn();
const strapiFetch = vi.fn();
vi.mock('./strapiServer', () => ({
  fetchAllPages: (...a: unknown[]) => fetchAllPages(...a),
  strapiFetch: (...a: unknown[]) => strapiFetch(...a),
}));

import { demoteTopOfMindProjects, TOP_OF_MIND } from './projectImportance';

const ok = { ok: true } as Response;
const failed = { ok: false } as Response;

/** The list endpoint returns these; each is currently 'top of mind'. */
function topOfMind(...ids: string[]) {
  fetchAllPages.mockResolvedValue(ids.map((documentId) => ({ documentId })));
}

/** documentIds of every project the code PUT, in call order. */
function writtenIds(): string[] {
  return strapiFetch.mock.calls.map(([, path]) => String(path).split('/').pop() as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  strapiFetch.mockResolvedValue(ok);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('demoteTopOfMindProjects', () => {
  it('returns the documentIds it demoted', async () => {
    topOfMind('a', 'b');

    await expect(demoteTopOfMindProjects('token')).resolves.toEqual(['a', 'b']);
  });

  it('returns an empty array when nothing is top of mind', async () => {
    topOfMind();

    await expect(demoteTopOfMindProjects('token')).resolves.toEqual([]);
    expect(strapiFetch).not.toHaveBeenCalled();
  });

  it('spares the project being promoted', async () => {
    // Requirement #1: the target keeps "top of mind". Without the skip, the
    // promotion sweep would demote the very project it was making room for.
    topOfMind('incumbent', 'target');

    await expect(demoteTopOfMindProjects('token', 'target')).resolves.toEqual(['incumbent']);
    expect(writtenIds()).toEqual(['incumbent']);
  });

  it('demotes every other project, not just the first', async () => {
    // The invariant permits exactly one. If two ever hold the slot, promoting a
    // third must clear both.
    topOfMind('a', 'b', 'c');

    await expect(demoteTopOfMindProjects('token', 'c')).resolves.toEqual(['a', 'b']);
  });

  it('writes importance "normal", which is importance\'s ordinary value', async () => {
    // Not 'default' — that is projectType's ordinary value. Mixing the two is a
    // documented 400 in this codebase.
    topOfMind('a');

    await demoteTopOfMindProjects('token');

    const [, , init] = strapiFetch.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ data: { importance: 'normal' } });
  });

  it('omits a project whose write failed, and keeps going', async () => {
    // The caller hands the returned ids to the browser as fact, so a failed
    // write must not be reported as demoted — the row is still top of mind.
    topOfMind('a', 'b', 'c');
    strapiFetch.mockResolvedValueOnce(ok).mockResolvedValueOnce(failed).mockResolvedValueOnce(ok);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(demoteTopOfMindProjects('token')).resolves.toEqual(['a', 'c']);
    expect(writtenIds()).toEqual(['a', 'b', 'c']); // 'b' failing did not abort
  });

  it('filters server-side and pages, rather than filtering a truncated list in JS', async () => {
    // Strapi clamps pageSize to maxLimit: 100 and applies defaultLimit: 25 when
    // asked for nothing, without erroring. Filtering in JS over one page is why
    // promoting a project used to leave an older top-of-mind in place on an
    // account with more than 25 projects.
    topOfMind('a');

    await demoteTopOfMindProjects('token');

    expect(fetchAllPages).toHaveBeenCalledTimes(1);
    const [, url] = fetchAllPages.mock.calls[0];
    expect(url).toContain(`filters[importance][$eq]=${encodeURIComponent(TOP_OF_MIND)}`);
  });

  it("scopes every read and write to the caller's token", async () => {
    // Requirement #2: only the caller's own projects. Ownership is enforced by
    // the backend middleware keyed off this token, so threading it is the whole
    // of the frontend's obligation — there is no owner filter to hand-roll here,
    // and hand-rolling one would be the bug.
    topOfMind('a', 'b');

    await demoteTopOfMindProjects('caller-token');

    expect(fetchAllPages.mock.calls[0][0]).toBe('caller-token');
    for (const [token] of strapiFetch.mock.calls) expect(token).toBe('caller-token');
  });

  it('is idempotent: a second run with nothing left to demote is a no-op', async () => {
    topOfMind('a');
    await demoteTopOfMindProjects('token');

    topOfMind();
    await expect(demoteTopOfMindProjects('token')).resolves.toEqual([]);
  });
});
