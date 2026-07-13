import { describe, expect, it, vi } from 'vitest';

import {
  createOwnershipMiddleware,
  hasRelationValue,
  isContentApiRequest,
  mergeFilters,
} from './index';
import { OWNED_CONTENT_TYPES, ownerIsRequestUser } from './rule';

const UID = 'api::todo.todo';
const TASK_UID = 'api::task.task';
const ALICE = { id: 2 };
const BOB = { id: 3 };

/**
 * A fake Strapi. `url: null` means "no HTTP request" — a script or a lifecycle,
 * which is the case guard 2a must let through or the backfill cannot run.
 */
function fakeStrapi({
  url,
  user,
  row,
}: {
  url?: string | null;
  user?: any;
  row?: any;
} = {}) {
  return {
    requestContext: {
      get: () => (url === null || url === undefined ? undefined : { request: { url }, state: { user } }),
    },
    config: { get: (_key: string, fallback: any) => fallback },
    db: { query: () => ({ findOne: async () => row ?? null }) },
  };
}

function middleware(strapi: any) {
  return createOwnershipMiddleware({
    strapi,
    contentTypes: [UID],
    rule: ownerIsRequestUser,
  });
}

const run = (mw: any, ctx: any) => {
  const next = vi.fn().mockResolvedValue('ok');
  return { next, result: mw({ uid: UID, params: {}, ...ctx }, next) };
};

describe('mergeFilters', () => {
  it('returns the added filter when none exists', () => {
    expect(mergeFilters(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(mergeFilters({}, { a: 1 })).toEqual({ a: 1 });
  });

  it('$and-merges so a caller cannot override the owner predicate', () => {
    const hostile = { owner: { id: { $eq: 3 } } };
    const ours = { owner: { id: { $eq: 2 } } };
    // A spread would let the hostile value win. $and means both must hold.
    expect(mergeFilters(hostile, ours)).toEqual({ $and: [hostile, ours] });
  });
});

describe('isContentApiRequest', () => {
  it('matches the content-API prefix exactly or as a path segment', () => {
    expect(isContentApiRequest('/api', '/api')).toBe(true);
    expect(isContentApiRequest('/api/todos?x=1', '/api')).toBe(true);
  });

  it('does not match the admin panel or lookalike prefixes', () => {
    expect(isContentApiRequest('/content-manager/collection-types/api::todo.todo', '/api')).toBe(false);
    expect(isContentApiRequest('/admin/login', '/api')).toBe(false);
    expect(isContentApiRequest('/apixyz/todos', '/api')).toBe(false);
    expect(isContentApiRequest('', '/api')).toBe(false);
  });
});

describe('hasRelationValue', () => {
  it('accepts the shapes the content API and admin panel actually send', () => {
    expect(hasRelationValue(2)).toBe(true);
    expect(hasRelationValue('abc123')).toBe(true);
    expect(hasRelationValue({ id: 2 })).toBe(true);
    expect(hasRelationValue({ documentId: 'abc' })).toBe(true);
    expect(hasRelationValue({ connect: [{ id: 2 }] })).toBe(true);
    expect(hasRelationValue({ set: [{ id: 2 }] })).toBe(true);
  });

  it('rejects absent or empty relations', () => {
    expect(hasRelationValue(null)).toBe(false);
    expect(hasRelationValue(undefined)).toBe(false);
    expect(hasRelationValue([])).toBe(false);
    expect(hasRelationValue({ connect: [] })).toBe(false);
    expect(hasRelationValue({ disconnect: [{ id: 2 }] })).toBe(false);
  });
});

describe('guard 1 — content-type allowlist', () => {
  it('passes through content types it does not own', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/users', user: ALICE }));
    const params = {};
    const next = vi.fn();
    await mw({ uid: 'plugin::users-permissions.user', action: 'findMany', params }, next);
    expect(next).toHaveBeenCalled();
    expect(params).toEqual({}); // untouched — no filter injected
  });
});

describe('guard 2 — no request context', () => {
  it('passes through when there is no HTTP request (scripts, lifecycles, plugin internals)', async () => {
    const mw = middleware(fakeStrapi({ url: null }));
    const params: any = {};
    const next = vi.fn();
    await mw({ uid: UID, action: 'findMany', params }, next);
    expect(next).toHaveBeenCalled();
    expect(params.filters).toBeUndefined();
  });
});

describe('guard 3 — content API fails closed', () => {
  it('rejects an authenticated-looking request with no user (e.g. an API token)', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: undefined }));
    const next = vi.fn();
    await expect(mw({ uid: UID, action: 'findMany', params: {} }, next)).rejects.toThrow(
      /Authentication required/
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('scopes reads to the caller', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: ALICE }));
    for (const action of ['findMany', 'findFirst', 'findOne', 'count']) {
      const params: any = {};
      await mw({ uid: UID, action, params }, vi.fn());
      expect(params.filters, `action=${action}`).toEqual({ owner: { id: { $eq: 2 } } });
    }
  });

  it('stamps create with the caller, overwriting a client-supplied owner', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: ALICE }));
    const params: any = { data: { title: 't', owner: BOB.id } };
    await mw({ uid: UID, action: 'create', params }, vi.fn());
    expect(params.data.owner).toBe(ALICE.id);
  });

  it('throws NotFound — not Forbidden — when updating someone else’s row', async () => {
    // update() ignores `filters`, so this lookup is the only thing standing
    // between a caller and another tenant's row.
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: ALICE, row: { owner: BOB } }));
    const next = vi.fn();
    await expect(
      mw({ uid: UID, action: 'update', params: { documentId: 'x' } }, next)
    ).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows update of a row the caller owns', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: ALICE, row: { owner: ALICE } }));
    const next = vi.fn().mockResolvedValue('ok');
    await mw({ uid: UID, action: 'update', params: { documentId: 'x' } }, next);
    expect(next).toHaveBeenCalled();
  });

  it('treats a missing row as NotFound', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: ALICE, row: null }));
    await expect(
      mw({ uid: UID, action: 'delete', params: { documentId: 'gone' } }, vi.fn())
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('re-stamps a clone, so it does not inherit the source row’s owner', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: ALICE, row: { owner: ALICE } }));
    const params: any = { documentId: 'x', data: {} };
    await mw({ uid: UID, action: 'clone', params }, vi.fn());
    expect(params.data.owner).toBe(ALICE.id);
  });

  it('fails closed on an unrecognised action', async () => {
    const mw = middleware(fakeStrapi({ url: '/api/todos', user: ALICE }));
    await expect(mw({ uid: UID, action: 'somethingNew', params: {} }, vi.fn())).rejects.toThrow(
      /Unsupported document action/
    );
  });
});

describe('guard 4 — the admin panel', () => {
  const ADMIN_URL = '/content-manager/collection-types/api::todo.todo';

  it('leaves admin reads unscoped: the operator sees every tenant', async () => {
    const mw = middleware(fakeStrapi({ url: ADMIN_URL, user: { id: 1 } }));
    const params: any = {};
    const next = vi.fn();
    await mw({ uid: UID, action: 'findMany', params }, next);
    expect(next).toHaveBeenCalled();
    expect(params.filters).toBeUndefined();
  });

  it('never treats the admin user id as an owner id', async () => {
    // ctx.state.user in an admin request is an *admin* user, from another table.
    const adminUser = { id: 1 };
    const mw = middleware(fakeStrapi({ url: ADMIN_URL, user: adminUser }));
    const params: any = { data: { title: 't', owner: { connect: [{ id: 2 }] } } };
    await mw({ uid: UID, action: 'create', params }, vi.fn());
    expect(params.data.owner).toEqual({ connect: [{ id: 2 }] }); // untouched, not stamped with 1
  });

  it('rejects an owner-less create — the `required` the Content-Type Builder will not give us', async () => {
    const mw = middleware(fakeStrapi({ url: ADMIN_URL, user: { id: 1 } }));
    const next = vi.fn();
    await expect(
      mw({ uid: UID, action: 'create', params: { data: { title: 't' } } }, next)
    ).rejects.toMatchObject({ name: 'ValidationError' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a create that names an owner', async () => {
    const mw = middleware(fakeStrapi({ url: ADMIN_URL, user: { id: 1 } }));
    const next = vi.fn().mockResolvedValue('ok');
    await mw({ uid: UID, action: 'create', params: { data: { owner: { connect: [{ id: 2 }] } } } }, next);
    expect(next).toHaveBeenCalled();
  });

  it('does not block admin updates or deletes', async () => {
    const mw = middleware(fakeStrapi({ url: ADMIN_URL, user: { id: 1 } }));
    for (const action of ['update', 'delete']) {
      const next = vi.fn().mockResolvedValue('ok');
      await mw({ uid: UID, action, params: { documentId: 'x' } }, next);
      expect(next, `action=${action}`).toHaveBeenCalled();
    }
  });
});

// `task` is the rename target of `todo`. The middleware is content-type-agnostic
// — it owns whatever is in OWNED_CONTENT_TYPES — so these build it with the REAL
// list and drive `api::task.task` through the same guards, proving the new type
// is isolated exactly like todo. (Both coexist until Stage 6 of the rename.)
describe('task is an owned content type (todo→task rename)', () => {
  // Middleware configured with the production owned-types list, not a stub.
  const ownedMiddleware = (strapi: any) =>
    createOwnershipMiddleware({ strapi, contentTypes: OWNED_CONTENT_TYPES, rule: ownerIsRequestUser });

  it('OWNED_CONTENT_TYPES carries both todo and task during coexistence', () => {
    expect(OWNED_CONTENT_TYPES).toContain(TASK_UID);
    expect(OWNED_CONTENT_TYPES).toContain(UID);
  });

  it('scopes task reads to the caller', async () => {
    const mw = ownedMiddleware(fakeStrapi({ url: '/api/tasks', user: ALICE }));
    const params: any = {};
    await mw({ uid: TASK_UID, action: 'findMany', params }, vi.fn());
    expect(params.filters).toEqual({ owner: { id: { $eq: 2 } } });
  });

  it('stamps a task create with the caller, overwriting a client-supplied owner', async () => {
    const mw = ownedMiddleware(fakeStrapi({ url: '/api/tasks', user: ALICE }));
    const params: any = { data: { title: 't', owner: BOB.id } };
    await mw({ uid: TASK_UID, action: 'create', params }, vi.fn());
    expect(params.data.owner).toBe(ALICE.id);
  });

  it('authorizes a task write by lookup — NotFound on another tenant’s row', async () => {
    const mw = ownedMiddleware(fakeStrapi({ url: '/api/tasks', user: ALICE, row: { owner: BOB } }));
    await expect(
      mw({ uid: TASK_UID, action: 'update', params: { documentId: 'x' } }, vi.fn())
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('allows a task write the caller owns', async () => {
    const mw = ownedMiddleware(fakeStrapi({ url: '/api/tasks', user: ALICE, row: { owner: ALICE } }));
    const next = vi.fn().mockResolvedValue('ok');
    await mw({ uid: TASK_UID, action: 'update', params: { documentId: 'x' } }, next);
    expect(next).toHaveBeenCalled();
  });
});
