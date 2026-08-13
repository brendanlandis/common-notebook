/**
 * The ownership rule for common-notebook: a row belongs to exactly one user.
 *
 * Kept separate from the middleware so the middleware stays app-agnostic.
 * slownames.net will supply a different rule (a row belongs to a collective,
 * and a user belongs to many) against the same machinery.
 */

export interface OwnershipRule {
  /** The relation field carrying ownership. Used for the admin-create check. */
  field: string;
  /** Merged into `params.filters` on reads. */
  filter(user: any): Record<string, any>;
  /** Merged into `params.data` on create. */
  stamp(user: any): Record<string, any>;
  /** Relations to populate when loading a row to authorize a write. */
  populate: string[];
  /** True if `row` (loaded with `populate`) belongs to `user`. */
  owns(row: any, user: any): boolean;
}

/**
 * The content types that carry an `owner`. Nothing else is touched.
 *
 * A type missing from this list is not owner-scoped **at all** — the middleware
 * short-circuits on anything it doesn't recognise (see `owned.has(uid)`), so the
 * omission fails open and silently. Add the entry when you add the type, not
 * when you notice.
 *
 * Add the entry in the same change as the schema — not before it. This list is
 * also what `permissions/index.ts` derives the authenticated role's CRUD grants
 * from, so a uid listed here before its content type exists seeds permission
 * rows for endpoints that have no route, and makes `warnOnUnownedRows` log on
 * every boot. Both are harmless and neither fails the boot, but "the
 * authorization surface, in git" is worth keeping honest.
 */
export const OWNED_CONTENT_TYPES = [
  'api::task.task',
  'api::project.project',
  'api::world.world',
  'api::view.view',
  'api::practice-log.practice-log',
  'api::system-setting.system-setting',
  'api::review.review',
  'api::daily-pick.daily-pick',
] as const;

export const ownerIsRequestUser: OwnershipRule = {
  field: 'owner',
  filter: (user) => ({ owner: { id: { $eq: user.id } } }),
  stamp: (user) => ({ owner: user.id }),
  populate: ['owner'],
  owns: (row, user) => row?.owner?.id === user.id,
};
