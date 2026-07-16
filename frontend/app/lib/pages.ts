import { isBetaPath } from './betaConfig';

/**
 * The app's primary destinations — the pages a user navigates *to*.
 *
 * Chrome is deliberately absent: `/settings` is a gear icon beside the theme toggle,
 * and `/` renders nothing. Listing only real destinations is what lets `soleDestination`
 * mean "this user has nowhere else to go".
 */
export const MAIN_PAGES = ['/todo', '/practice'] as const;

/** The pages `betaAccess` actually lets this user reach. */
export function visiblePages(betaAccess: boolean): string[] {
  return MAIN_PAGES.filter((p) => betaAccess || !isBetaPath(p));
}

/**
 * This user's only destination, or null when they have a choice (or none at all).
 *
 * Drives the `/` → `/todo` redirect, and hides the home link that would point at it.
 * Self-cancelling: add a second non-beta page to MAIN_PAGES and this returns null,
 * so the redirect stops firing on its own.
 *
 * Never returns '/', so a caller redirecting to the result cannot loop.
 */
export function soleDestination(betaAccess: boolean): string | null {
  const pages = visiblePages(betaAccess);
  return pages.length === 1 ? pages[0] : null;
}
