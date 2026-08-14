'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiSend } from '@/app/lib/apiFetch';
import type { Task } from '@/app/types/index';
import { reviewCoveringKey, type Review } from './useReview';
import { dailyPickKey, type DailyPick } from './useDailyPick';

/**
 * Ticking something off, from the daily page.
 *
 * The To Do page has its own, wired into a context and two list caches; this is
 * the small version for the one place on this page that completes anything. It
 * writes optimistically into the two queries the daily page actually renders —
 * the review covering today and today's pick — because a checkbox that waits for
 * a round trip before moving is a checkbox you click twice.
 *
 * Completing is a toggle across two endpoints, the same as it is on To Do:
 * there's a dedicated endpoint for completing (it also materialises a recurring
 * task's next occurrence) and a plain field write for un-completing.
 */
export function useCompleteTask(date: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      documentId,
      isCurrentlyCompleted,
    }: {
      documentId: string;
      isCurrentlyCompleted: boolean;
    }) =>
      isCurrentlyCompleted
        ? apiSend(`/api/tasks/${documentId}`, 'PUT', { completed: false, completedAt: null })
        : apiSend(`/api/tasks/${documentId}/complete`, 'POST'),

    onMutate: async ({ documentId, isCurrentlyCompleted }) => {
      const reviewKey = reviewCoveringKey(date);
      const pickKey = dailyPickKey(date);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: reviewKey }),
        queryClient.cancelQueries({ queryKey: pickKey }),
      ]);

      const previousReview = queryClient.getQueryData<Review | null>(reviewKey);
      const previousPick = queryClient.getQueryData<DailyPick | null>(pickKey);

      const completed = !isCurrentlyCompleted;
      // A real instant, not a wall-clock string: `completedAt` is compared
      // against other instants everywhere it's read. Nothing on this page
      // displays it, so precision matters more than presentation.
      const completedAt = completed ? new Date().toISOString() : null;
      const apply = (tasks: Task[]) =>
        tasks.map((task) =>
          task.documentId === documentId ? { ...task, completed, completedAt } : task
        );

      queryClient.setQueryData<Review | null>(reviewKey, (current) =>
        current ? { ...current, tasks: apply(current.tasks) } : current
      );
      queryClient.setQueryData<DailyPick | null>(pickKey, (current) =>
        current ? { ...current, tasks: apply(current.tasks) } : current
      );

      return { previousReview, previousPick };
    },

    onError: (_error, _variables, context) => {
      // Put the tick back where it was. Without this a failed write leaves a box
      // ticked and lying until something else refetches.
      if (context?.previousReview !== undefined) {
        queryClient.setQueryData(reviewCoveringKey(date), context.previousReview);
      }
      if (context?.previousPick !== undefined) {
        queryClient.setQueryData(dailyPickKey(date), context.previousPick);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['daily-pick'] });
      // The To Do page's lists are stale now too. Not `['tasks','active']`,
      // which applies the completed-visibility window server-side and would drop
      // a just-ticked task on an account whose window is zero.
      queryClient.invalidateQueries({
        queryKey: ['tasks'],
        predicate: (query) => query.queryKey[1] !== 'active',
      });
    },
  });

  return { toggleComplete: mutation.mutate, error: mutation.error };
}
