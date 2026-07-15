/**
 * Pages that are still "in beta" — visible in the menu and loadable only by a user
 * whose Strapi record has `betaAccess: true`. Everyone else gets a 404 and no menu
 * link (see BetaGuard and MenuItems, gated on the `/api/me` beta flag).
 *
 * This is the single place a page is "marked" beta: add its path here and both the
 * menu link and the route are gated. Sub-routes are covered automatically — the
 * guard matches a path or any of its descendants.
 *
 * Note this is a UX gate, not a data-authorization boundary. Page data is still
 * fetched through `app/api/*`, which sends a token Strapi verifies and scopes to
 * the caller, so a bypass reveals only the caller's own (empty) data — never
 * another user's.
 */
export const BETA_PATHS = ['/practice'] as const;

/**
 * True when `pathname` is a beta path or a descendant of one. The `+ '/'` guard
 * keeps `/practiceroom` from matching `/practice`.
 */
export function isBetaPath(pathname: string): boolean {
  return BETA_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
