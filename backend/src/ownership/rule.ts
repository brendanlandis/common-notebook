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

/** The content types that carry an `owner`. Nothing else is touched. */
export const OWNED_CONTENT_TYPES = [
  'api::task.task',
  'api::project.project',
  'api::practice-log.practice-log',
  'api::system-setting.system-setting',
] as const;

export const ownerIsRequestUser: OwnershipRule = {
  field: 'owner',
  filter: (user) => ({ owner: { id: { $eq: user.id } } }),
  stamp: (user) => ({ owner: user.id }),
  populate: ['owner'],
  owns: (row, user) => row?.owner?.id === user.id,
};
