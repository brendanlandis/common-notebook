import { NextResponse } from 'next/server';
import { SessionEndedError } from './authErrors';
import { clearAuthCookies } from './strapiAuth';

/**
 * A route handler's answer when something threw. `SessionEndedError` is a 401
 * that clears the cookies: the browser goes to /login (`QueryProvider`), and
 * pages stop rendering for the session. Anything else is logged under `what` and
 * answered 500.
 */
export function errorResponse(what: string, error: unknown): NextResponse {
  if (error instanceof SessionEndedError) {
    console.warn(`[auth] ${error.message}: the user is blocked or deleted, so the session ends`);
    const res = NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  console.error(what, error);
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
