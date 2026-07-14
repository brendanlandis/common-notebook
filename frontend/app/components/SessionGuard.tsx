'use client';

import { useEffect } from 'react';

/**
 * On every authed page load, ask the server whether the session is still live.
 *
 * `proxy.ts` renders the shell whenever the refresh cookie merely *decodes* as
 * unexpired, so a session the backend has revoked slips through and every data
 * call 401s. This runs one check on mount: a 401 means the session is dead (and
 * the server has already cleared the cookies), so bounce to /login — no user
 * interaction required. A hard navigation lets proxy.ts re-gate cleanly.
 */
export default function SessionGuard() {
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((res) => {
        if (
          !cancelled &&
          res.status === 401 &&
          window.location.pathname !== '/login'
        ) {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        /* network hiccup — leave the page alone rather than bounce spuriously */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
