'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import {
  LOCATION_SETTING,
  parseLocation,
  serializeLocation,
  type Location,
} from '@/app/lib/location';

/**
 * Where the user is, from its `system-setting` row.
 *
 * Same shape as `useReviewCadence`, and keyed under the same
 * `['system-settings', …]` prefix so one invalidate covers the family.
 */
export const LOCATION_QUERY_KEY = ['system-settings', LOCATION_SETTING] as const;

interface SettingResponse {
  success?: boolean;
  value?: string | null;
}

export function useLocation() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LOCATION_QUERY_KEY,
    queryFn: async () => {
      const body = await apiFetch<SettingResponse>(
        `/api/system-settings?title=${LOCATION_SETTING}`
      );
      // A missing row is not an error — an account that has never opened
      // settings has none, and `parseLocation(null)` is the default.
      return parseLocation(body.value);
    },
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (location: Location) =>
      apiSend('/api/system-settings', 'PUT', {
        title: LOCATION_SETTING,
        value: serializeLocation(location),
      }),
    // Written locally first: this drives a form, and waiting for the round trip
    // would make the field snap back to its old value while you typed.
    onMutate: async (location) => {
      await queryClient.cancelQueries({ queryKey: LOCATION_QUERY_KEY });
      const previous = queryClient.getQueryData<Location>(LOCATION_QUERY_KEY);
      queryClient.setQueryData(LOCATION_QUERY_KEY, location);
      return { previous };
    },
    onError: (_error, _location, context) => {
      if (context?.previous) {
        queryClient.setQueryData(LOCATION_QUERY_KEY, context.previous);
      }
    },
  });

  return {
    location: query.data ?? null,
    loading: query.isPending,
    save: save.mutate,
    saveError: save.error,
  };
}
