'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import type { Task } from '@/app/types/index';

/**
 * Reviews, and the task selection each one holds.
 *
 * Keys nest under a shared `['reviews']` root so writing a selection can
 * invalidate the family in one call — the review page and the daily page read
 * different queries off the same rows.
 */
export const REVIEWS_KEY = ['reviews'] as const;
export const reviewCoveringKey = (date: string) => ['reviews', 'covering', date] as const;

export interface Review {
  documentId: string;
  periodStart: string;
  periodEnd: string;
  cycleType: string | null;
  anchorDate: string | null;
  tasks: Task[];
}

interface ReviewsResponse {
  success?: boolean;
  data?: Review[];
}

interface ReviewResponse {
  success?: boolean;
  data?: Review;
}

/** The review covering a given day, or null when none does. */
export function useReviewCovering(date: string | null) {
  const query = useQuery({
    queryKey: reviewCoveringKey(date ?? ''),
    enabled: date !== null,
    queryFn: async () => {
      const body = await apiFetch<ReviewsResponse>(`/api/reviews?on=${date}`);
      // Sorted newest first, so a re-review of the same span wins over the
      // original — which is what re-running a review is meant to do.
      return body.data?.[0] ?? null;
    },
  });

  return { review: query.data ?? null, loading: query.isPending };
}

export function useSaveReview() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (review: {
      periodStart: string;
      periodEnd: string;
      cycleType: string | null;
      anchorDate: string | null;
      tasks: string[];
    }) => apiSend<ReviewResponse>('/api/reviews', 'POST', review),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY }),
  });

  const update = useMutation({
    mutationFn: ({ documentId, tasks }: { documentId: string; tasks: string[] }) =>
      apiSend<ReviewResponse>(`/api/reviews/${documentId}`, 'PUT', { tasks }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY }),
  });

  return {
    createReview: create.mutateAsync,
    updateReview: update.mutateAsync,
    isSaving: create.isPending || update.isPending,
    // Real error state rather than a swallowed console.error: committing a
    // review is the one write in this feature the user would notice losing.
    error: create.error ?? update.error,
  };
}
