'use client';

import { usePathname, notFound } from 'next/navigation';
import { ReactNode } from 'react';
import { isBetaPath } from '@/app/lib/betaConfig';
import { useBetaAccess } from '@/app/contexts/BetaAccessContext';

/**
 * Gates every route in BETA_PATHS (and its sub-routes) to users whose Strapi
 * record has `betaAccess`. A non-beta or logged-out user gets a 404 — the page
 * looks like it does not exist.
 *
 * Placed once in the (main) layout, so it covers all beta paths centrally:
 * marking a page beta is just adding it to BETA_PATHS. This is a UX gate, not a
 * data boundary — page data is still fetched through app/api/*, which Strapi
 * scopes to the caller.
 */
export default function BetaGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { betaAccess, loading } = useBetaAccess();

  if (isBetaPath(pathname)) {
    // Don't flash content — or a premature 404 — before we know who the user is.
    if (loading) return null;
    if (!betaAccess) notFound();
  }

  return <>{children}</>;
}
