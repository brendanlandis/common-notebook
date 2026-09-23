/**
 * Errors from session handling that mean something other than "logged out".
 * A leaf module with no app imports, so tests that mock `strapiAuth` still get
 * the real classes and `instanceof` keeps working.
 */

/**
 * The frontend can't verify tokens: `JWT_SECRET` is unset, or isn't the
 * backend's (a token Strapi just issued failed verification). Answered with a
 * loud 500, never a redirect to /login — that would loop, since every login
 * would fail the same way — and never by clearing cookies.
 */
export class AuthConfigError extends Error {
  name = 'AuthConfigError';
}

/**
 * Strapi couldn't be asked to renew a session: a timeout, a network error, or a
 * 5xx. The session isn't over, only unknown, so the cookies are left alone.
 */
export class SessionUnavailableError extends Error {
  name = 'SessionUnavailableError';
}
