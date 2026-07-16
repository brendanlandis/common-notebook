import { redirect } from "next/navigation";
import { getAccessTokenServer } from "@/app/lib/strapiAuth";
import { fetchBetaAccess } from "@/app/lib/currentUser";
import { soleDestination } from "@/app/lib/pages";
import HomeClient from "./HomeClient";

/**
 * Home renders nothing of its own. When a user has exactly one destination — today,
 * anyone without `betaAccess`, for whom /todo is the only non-beta page — send them
 * there rather than leaving them on a blank page.
 *
 * Resolved here on the server so no HTML is ever sent for a page we're about to
 * leave: deciding in the browser meant the shell painted, `/api/me` resolved, and
 * only then did the redirect fire — a visible flash of empty home.
 *
 * `getAccessTokenServer()` returns null when it cannot tell (a stale token it
 * won't refresh from a Server Component). That is not "logged out", so we must not
 * redirect on it — fall through to HomeClient, which resolves it the slow way.
 */
export default async function HomePage() {
  const token = await getAccessTokenServer();

  if (token) {
    const dest = soleDestination(await fetchBetaAccess(token));
    if (dest) redirect(dest);
  }

  return <HomeClient />;
}
