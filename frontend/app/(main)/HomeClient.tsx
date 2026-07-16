'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import FaviconManager from "@/app/components/FaviconManager";
import { useBetaAccess } from "@/app/hooks/useBetaAccess";
import { soleDestination } from "@/app/lib/pages";

/**
 * Home's actual (empty) body, plus a client-side fallback for the redirect.
 *
 * The server component normally redirects before this ever renders, so this path
 * only runs when the server could not tell — a stale access token, which it
 * refuses to refresh (see `getAccessTokenServer`). Here `/api/me` refreshes
 * properly through a route handler, at the cost of the brief flash the server
 * redirect exists to avoid.
 */
export default function HomeClient() {
  const router = useRouter();
  const { betaAccess, loading } = useBetaAccess();

  useEffect(() => {
    // Wait for the real flag: the context starts at `betaAccess: false`, which would
    // read as "only /todo" and bounce a beta user off their own home page.
    if (loading) return;

    const dest = soleDestination(betaAccess);
    // replace, not push — Back should leave, not bounce off the redirect again.
    if (dest) router.replace(dest);
  }, [loading, betaAccess, router]);

  return (
    <>
      <FaviconManager type="bird" />
      <main id="container-home">
      </main>
    </>
  );
}
