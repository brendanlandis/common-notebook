import { SessionEndedError } from './authErrors';
import { strapiFetch } from './strapiServer';

/**
 * The caller's own `betaAccess` flag, straight from Strapi, for
 * `app/api/me/route.ts`.
 *
 * Fails closed: any Strapi error, or an absent field, yields false — a beta page
 * stays hidden unless Strapi affirmatively says otherwise. An ended session is
 * the exception, so the route can answer it 401.
 */
export async function fetchBetaAccess(token: string): Promise<boolean> {
  try {
    const response = await strapiFetch(token, '/api/users/me');
    if (!response.ok) return false;
    const user = await response.json();
    return Boolean(user?.betaAccess);
  } catch (error) {
    if (error instanceof SessionEndedError) throw error;
    return false;
  }
}
