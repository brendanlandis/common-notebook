import { isBetaPath } from './betaConfig';

/**
 * The app's primary destinations — the pages a user navigates *to*.
 *
 * Chrome is deliberately absent: `/settings` is a gear icon beside the theme toggle.
 * `/` is the to-do list's default view; `/todo` itself only forwards there.
 */
export const MAIN_PAGES = ['/', '/practice', '/review/daily'] as const;

/** The pages `betaAccess` actually lets this user reach. */
export function visiblePages(betaAccess: boolean): string[] {
  return MAIN_PAGES.filter((p) => betaAccess || !isBetaPath(p));
}

/**
 * True on every to-do route: home (the default view) and everything under /todo
 * (other views, worlds, projects). The `+ '/'` guard keeps `/todos` out.
 */
export function isTodoPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/todo' || pathname.startsWith('/todo/');
}
