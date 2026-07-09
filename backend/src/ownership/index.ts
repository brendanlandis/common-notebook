/**
 * Tenant isolation, enforced in one place.
 *
 * `strapi.documents.use()` sits beneath every content-API read and write, so no
 * controller can bypass it. The middleware context carries `{ uid, action,
 * params }` but *not* the request user, so we reach the user through
 * `strapi.requestContext.get()`.
 *
 * NOT in `src/middlewares/` on purpose: Strapi auto-loads that directory and
 * registers each file as a Koa middleware (`global::<name>`), which is a
 * different signature entirely.
 *
 * Three things make the guards subtle, all verified against Strapi 5.50:
 *
 *  1. The users-permissions plugin and the admin content-manager both call the
 *     document service. A naive middleware here breaks login and the admin
 *     panel, silently. Hence the two allowlists below.
 *  2. `update` and `clone` do not accept `filters` (see their `Params` types) —
 *     a filter merged into them is silently dropped and the write proceeds
 *     against any row. They must be authorized by an explicit lookup.
 *  3. Admin requests set `ctx.state.user` to an *admin* user, from a different
 *     table than app users. Its id must never be used as an owner id.
 */

import { errors } from '@strapi/utils';
import type { OwnershipRule } from './rule';

const { ForbiddenError, NotFoundError, ValidationError } = errors;

/** Accept `filters`, so an owner predicate can be merged in. */
const READ_ACTIONS = new Set(['findMany', 'findFirst', 'findOne', 'count']);

/**
 * Carry a `documentId` and must be authorized by lookup. `delete` does accept
 * `filters`, but is checked the same way so every write takes one path.
 */
const DOCUMENT_ACTIONS = new Set([
  'update',
  'delete',
  'clone',
  'publish',
  'unpublish',
  'discardDraft',
]);

/**
 * True if a relation payload names a target. The admin panel sends relations as
 * `{ connect: [{ id }] }` or `{ set: [...] }`; the content API sends a bare id
 * or documentId.
 */
export function hasRelationValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number' || typeof value === 'string') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    if (Array.isArray(value.connect)) return value.connect.length > 0;
    if (Array.isArray(value.set)) return value.set.length > 0;
    return 'id' in value || 'documentId' in value;
  }
  return false;
}

/**
 * `$and` rather than a shallow merge: the caller may already filter on `owner`
 * (e.g. `?filters[owner][id][$eq]=<someone else>`), and a spread would let their
 * value win.
 */
export function mergeFilters(existing: any, added: Record<string, any>) {
  if (!existing || Object.keys(existing).length === 0) return added;
  return { $and: [existing, added] };
}

/** True if this request is a content-API request rather than admin/plugin. */
export function isContentApiRequest(url: string, prefix: string): boolean {
  if (!url) return false;
  return url === prefix || url.startsWith(`${prefix}/`);
}

export function createOwnershipMiddleware({
  strapi,
  contentTypes,
  rule,
}: {
  strapi: any;
  contentTypes: readonly string[];
  rule: OwnershipRule;
}) {
  const owned = new Set<string>(contentTypes);

  /**
   * Authorize a write by loading the row. Uses `strapi.db.query` rather than the
   * document service so it does not re-enter this middleware.
   *
   * Throws NotFound, not Forbidden, for someone else's row: a 403 would confirm
   * that the documentId exists.
   */
  async function assertOwns(uid: string, documentId: string, user: any) {
    if (!documentId) throw new NotFoundError();
    const row = await strapi.db
      .query(uid)
      .findOne({ where: { documentId }, populate: rule.populate });
    if (!row || !rule.owns(row, user)) throw new NotFoundError();
  }

  return async function ownershipMiddleware(context: any, next: () => any) {
    const { uid, action, params } = context;

    // Guard 1 — content-type allowlist. The user model, upload files, and the
    // Invite type all pass through untouched.
    if (!owned.has(uid)) return next();

    // Guard 2a — no HTTP request: lifecycles, plugin internals, the seed and
    // backfill scripts. Pass through, or those scripts cannot function.
    const req = strapi.requestContext.get();
    if (!req) return next();

    // Guard 2b — positive-match the content-API prefix. Matching on `/admin`
    // would mean guessing at Strapi's admin internals; this way anything that
    // is not the content API (content-manager, upload, admin) falls to guard 4.
    const prefix = strapi.config.get('api.rest.prefix', '/api');
    if (!isContentApiRequest(req.request?.url, prefix)) {
      // Guard 4 — the admin panel. Reads stay unscoped: the operator sees every
      // tenant, by design. But require an owner on create, because Strapi's
      // Content-Type Builder offers no `required` for relations, and an
      // owner-less row would be invisible to every user.
      if (action === 'create' || action === 'clone') {
        if (!hasRelationValue(params?.data?.[rule.field])) {
          throw new ValidationError(
            `${rule.field} is required. Set it when creating a ${uid} from the admin panel.`
          );
        }
      }
      return next();
    }

    // Guard 3 — inside the content API, fail closed. An API token authenticates
    // as nobody and sets no `ctx.state.user`, so it cannot reach owned types.
    const user = req.state?.user;
    if (!user) throw new ForbiddenError('Authentication required.');

    if (READ_ACTIONS.has(action)) {
      params.filters = mergeFilters(params.filters, rule.filter(user));
      return next();
    }

    if (action === 'create') {
      // Overwrite rather than default: a client must not choose its own owner.
      params.data = { ...(params.data ?? {}), ...rule.stamp(user) };
      return next();
    }

    if (DOCUMENT_ACTIONS.has(action)) {
      await assertOwns(uid, params?.documentId, user);
      // A clone would otherwise inherit the source row's owner implicitly.
      if (action === 'clone') {
        params.data = { ...(params.data ?? {}), ...rule.stamp(user) };
      }
      return next();
    }

    // Unknown action on an owned type. Fail closed rather than let it through.
    throw new ForbiddenError(`Unsupported document action "${action}" on ${uid}.`);
  };
}
