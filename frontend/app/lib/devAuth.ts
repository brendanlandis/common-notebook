/**
 * Local-only dev auth bypass gate.
 *
 * When enabled, the frontend auto-authenticates every request as a fixed dev
 * user instead of requiring a login (see strapiAuth.ts / proxy.ts). This exists
 * purely to make local debugging and headless agent testing frictionless.
 *
 * It MUST be impossible to activate on production. The gate fails closed unless
 * ALL of the following hold, so a single leaked flag is never sufficient:
 *
 *   1. DEV_AUTH_BYPASS === 'true'      explicit opt-in; unset everywhere on prod
 *   2. NODE_ENV !== 'production'
 *   3. STRAPI_API_URL points at localhost/127.0.0.1 — so on a host whose Strapi
 *      is remote, even a leaked flag could only ever mint a token against a
 *      *local* Strapi, never impersonate a real user there.
 *
 * Prod may reach its own Strapi locally (slowhouse: 127.0.0.1:1338), so don't
 * count on 3 there. What keeps the bypass off on prod is 2: `next start` always
 * runs with NODE_ENV=production.
 *
 * This module reads process.env ONLY (no next/headers) so it is safe to import
 * from both middleware (proxy.ts) and route handlers.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function pointsAtLocalStrapi(): boolean {
  const url = process.env.STRAPI_API_URL;
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** True only when the local dev auth bypass is safe to activate. */
export function devAuthBypassEnabled(): boolean {
  return (
    process.env.DEV_AUTH_BYPASS === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    pointsAtLocalStrapi()
  );
}

/**
 * Credentials for the dev user to impersonate locally. Defaults to the
 * `seed_alice` account created by backend/scripts/seed-dev.js (and
 * seed-practice.js). Only consulted when devAuthBypassEnabled() is true.
 */
export function getDevCredentials(): { identifier: string; password: string } {
  return {
    identifier: process.env.DEV_AUTH_USER || 'seed_alice',
    password: process.env.DEV_AUTH_PASSWORD || 'seedpassword123',
  };
}
