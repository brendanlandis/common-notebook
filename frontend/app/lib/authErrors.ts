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

/**
 * Strapi refused a token this server had verified. Strapi checks on every request
 * that the user still exists and isn't blocked, so one of those changed after the
 * token was issued. The session is over: `errorResponse` answers 401 and clears
 * the cookies.
 */
export class SessionEndedError extends Error {
  name = 'SessionEndedError';
}
