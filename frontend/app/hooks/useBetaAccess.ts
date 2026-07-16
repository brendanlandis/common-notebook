'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/app/lib/apiFetch';

/**
 * Whether the current user may see pages that are still "in beta".
 *
 * `betaAccess` is a boolean on the Strapi User record; it gates pages listed in
 * `app/lib/betaConfig.ts`. The check is server-side because the client has no
 * trustworthy notion of who it is — the token identifying the caller is httpOnly
 * and only `/api/me` sends it to Strapi.
 *
 * Fails closed. `/api/me` already answers `betaAccess: false` for any Strapi
 * error, and `apiFetch` throws on a 401, which lands here as `isError` — both
 * paths yield `betaAccess: false`, so a beta page stays hidden unless Strapi
 * affirmatively says otherwise.
 */
export const BETA_ACCESS_QUERY_KEY = ['me', 'betaAccess'] as const;

interface MeResponse {
  success?: boolean;
  betaAccess?: boolean;
}

export function useBetaAccess(): { betaAccess: boolean; loading: boolean } {
  const { data, isPending } = useQuery({
    queryKey: BETA_ACCESS_QUERY_KEY,
    queryFn: () => apiFetch<MeResponse>('/api/me'),
    // Whether an account is in the beta does not change mid-session.
    staleTime: 5 * 60_000,
  });

  return {
    betaAccess: data?.betaAccess === true,
    // Consumers must not 404 a beta page (or reveal a beta menu link) before the
    // answer arrives.
    loading: isPending,
  };
}
