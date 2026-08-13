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
 * Registering a type before its schema is deployed is safe and deliberate: the
 * middleware simply never matches it, and `warnOnUnownedRows` catches the
 * missing-table error per type and logs a warning rather than failing the boot.
 * That is what lets the entry land with the code that needs it.
 */
export const OWNED_CONTENT_TYPES = [
  'api::task.task',
  'api::project.project',
  'api::world.world',
  'api::view.view',
  'api::practice-log.practice-log',
  'api::system-setting.system-setting',
  // Weekly review. Registered ahead of the schema — see the note above.
  'api::review.review',
  'api::daily-pick.daily-pick',
  'api::calendar-subscription.calendar-subscription',
  'api::calendar-event-decision.calendar-event-decision',
] as const;

export const ownerIsRequestUser: OwnershipRule = {
  field: 'owner',
  filter: (user) => ({ owner: { id: { $eq: user.id } } }),
  stamp: (user) => ({ owner: user.id }),
  populate: ['owner'],
  owns: (row, user) => row?.owner?.id === user.id,
};
