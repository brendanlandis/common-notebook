'use client';

import { useEffect } from 'react';

/**
 * On every authed page load, ask the server whether the session is still live.
 *
 * `proxy.ts` has already verified the session before rendering, so this mostly
 * agrees with it; it covers a page restored without a request (the back-forward
 * cache) and a session dropped since. A 401 means the session is dead (and the
 * server has already cleared the cookies), so bounce to /login — no user
 * interaction required. A hard navigation lets proxy.ts re-gate cleanly. A 503
 * or 500 is not a logout, so it's left alone. The session check never calls
 * Strapi while the access token is good.
 */
export default function SessionGuard() {
  useEffect(() => {
    let canceled = false;
    fetch('/api/auth/session')
      .then((res) => {
        if (
          !canceled &&
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
      canceled = true;
    };
  }, []);

  return null;
}
