/**
 * What a new password must be, for the forms and the routes behind them.
 *
 * Strapi hashes passwords with bcrypt, which reads the first 72 bytes and
 * ignores the rest: a longer password would work with anything typed after its
 * 72nd byte. Strapi's reset route refuses one, but `POST /api/users`, which
 * invite redemption uses, checks neither length, so the routes check both.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_TOO_SHORT = `at least ${PASSWORD_MIN_LENGTH} characters`;
export const PASSWORD_TOO_LONG = 'at most 72 characters, fewer with accents or emoji';

export function passwordBytes(password: string): number {
  return new TextEncoder().encode(password).length;
}

/** What's wrong with a new password (`PASSWORD_TOO_SHORT` or `_LONG`), or null. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_TOO_SHORT;
  if (passwordBytes(password) > PASSWORD_MAX_BYTES) return PASSWORD_TOO_LONG;
  return null;
}
