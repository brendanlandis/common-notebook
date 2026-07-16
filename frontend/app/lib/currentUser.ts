const STRAPI_API_URL = process.env.STRAPI_API_URL;

/**
 * The caller's own `betaAccess` flag, straight from Strapi.
 *
 * Shared by `app/api/me/route.ts` (for the client) and the `/` Server Component
 * (which redirects before rendering, so there is no flash). Both need the same
 * fail-closed answer, so the fetch lives here rather than in either caller.
 *
 * Fails closed: any Strapi error, or an absent field, yields false — a beta page
 * stays hidden unless Strapi affirmatively says otherwise.
 */
export async function fetchBetaAccess(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${STRAPI_API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const user = await response.json();
    return Boolean(user?.betaAccess);
  } catch {
    return false;
  }
}
