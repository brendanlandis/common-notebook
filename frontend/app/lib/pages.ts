import { isBetaPath } from './betaConfig';

/**
 * The app's primary destinations — the pages a user navigates *to*.
 *
 * Chrome is deliberately absent: `/settings` is a gear icon beside the theme toggle.
 * `/` is the to-do list's default view.
 */
export const MAIN_PAGES = ['/', '/practice', '/review/daily'] as const;

/** The pages `betaAccess` actually lets this user reach. */
export function visiblePages(betaAccess: boolean): string[] {
  return MAIN_PAGES.filter((p) => betaAccess || !isBetaPath(p));
}

const TODO_PREFIXES = ['/view/', '/world/', '/project/'];

/**
 * True on every to-do route: home (the default view), other views, worlds and
 * projects. The trailing `/` keeps `/viewer` from matching `/view`.
 */
export function isTodoPath(pathname: string): boolean {
  return pathname === '/' || TODO_PREFIXES.some((p) => pathname.startsWith(p));
}
