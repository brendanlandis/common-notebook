'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The TanStack Query client for the authed app.
 *
 * Mounted in `(main)/layout.tsx`, not the root layout: the root having no
 * providers is what keeps `/login` and `/redeem-invite` free of them, and none of
 * those pages hold server state worth caching.
 *
 * The client is built in `useState`, never at module scope. A module-scope client
 * is one object shared by every request the Node process serves, which under SSR
 * means one user's cached tasks answering the next user's request.
 *
 * No `HydrationBoundary`/`dehydrate`: the only async Server Component is
 * `(main)/page.tsx`, and it just redirects. Time settings reach the client as
 * plain props from the layout (`DateTimeSettingsProvider`), which is simpler than
 * prefetch-and-hydrate and costs nothing here.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough that remounting a component (the task drawer opens and
        // closes constantly) reuses the cache, short enough that a real edit
        // elsewhere shows up.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // One droplet, through our own BFF. The default of 3 turns a 500 into a
        // ~7-second hang with no UI signal; fail fast and visibly instead.
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
