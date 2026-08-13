'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import {
  REVIEW_CADENCE_SETTING,
  parseReviewCadence,
  serializeReviewCadence,
  type ReviewCadence,
} from '@/app/lib/reviewCadence';

/**
 * The user's review cadence, read from and written to its `system-setting` row.
 *
 * Keyed under a `['system-settings', …]` prefix so a future settings query can
 * join the family and one invalidate covers them.
 */
export const REVIEW_CADENCE_QUERY_KEY = ['system-settings', REVIEW_CADENCE_SETTING] as const;

interface SettingResponse {
  success?: boolean;
  value?: string | null;
}

export function useReviewCadence() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: REVIEW_CADENCE_QUERY_KEY,
    queryFn: async () => {
      const body = await apiFetch<SettingResponse>(
        `/api/system-settings?title=${REVIEW_CADENCE_SETTING}`
      );
      // A missing row is not an error — an account that has never opened
      // settings has none, and `parseReviewCadence(null)` is the default.
      return parseReviewCadence(body.value);
    },
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (cadence: ReviewCadence) =>
      apiSend('/api/system-settings', 'PUT', {
        title: REVIEW_CADENCE_SETTING,
        value: serializeReviewCadence(cadence),
      }),
    // Write it locally first: this drives a form, and waiting for the round trip
    // would make every select snap back to its old value for the duration.
    onMutate: async (cadence) => {
      await queryClient.cancelQueries({ queryKey: REVIEW_CADENCE_QUERY_KEY });
      const previous = queryClient.getQueryData<ReviewCadence>(REVIEW_CADENCE_QUERY_KEY);
      queryClient.setQueryData(REVIEW_CADENCE_QUERY_KEY, cadence);
      return { previous };
    },
    onError: (_error, _cadence, context) => {
      if (context?.previous) {
        queryClient.setQueryData(REVIEW_CADENCE_QUERY_KEY, context.previous);
      }
    },
  });

  return {
    cadence: query.data ?? null,
    loading: query.isPending,
    save: save.mutate,
    saveError: save.error,
    isSaving: save.isPending,
  };
}
