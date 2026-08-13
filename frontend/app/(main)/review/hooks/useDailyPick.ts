'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import type { Task } from '@/app/types/index';

/**
 * Today's narrowed selection.
 *
 * Optional by design: a day with no pick shows the whole review selection rather
 * than an empty page, so skipping a morning degrades to something still correct
 * instead of something wrong. The page decides that; this hook just reports null.
 */
export const dailyPickKey = (date: string) => ['daily-pick', date] as const;

export interface DailyPick {
  documentId: string;
  date: string;
  tasks: Task[];
}

interface DailyPickResponse {
  success?: boolean;
  data?: DailyPick | null;
}

export function useDailyPick(date: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dailyPickKey(date),
    queryFn: async () => {
      const body = await apiFetch<DailyPickResponse>(`/api/daily-picks?date=${date}`);
      return body.data ?? null;
    },
  });

  const save = useMutation({
    mutationFn: (taskIds: string[]) =>
      apiSend<DailyPickResponse>('/api/daily-picks', 'PUT', { date, tasks: taskIds }),
    // Optimistic, because this drives checkboxes: waiting for the round trip
    // would make each tick visibly bounce back before settling.
    onMutate: async (taskIds) => {
      await queryClient.cancelQueries({ queryKey: dailyPickKey(date) });
      const previous = queryClient.getQueryData<DailyPick | null>(dailyPickKey(date));
      queryClient.setQueryData<DailyPick | null>(dailyPickKey(date), (current) =>
        current
          ? { ...current, tasks: taskIds.map((id) => ({ documentId: id }) as Task) }
          : current
      );
      return { previous };
    },
    onError: (_error, _ids, context) => {
      queryClient.setQueryData(dailyPickKey(date), context?.previous ?? null);
    },
    // Settle against the server either way — the optimistic value holds only
    // documentIds, not the populated tasks the UI wants to render.
    onSettled: () => queryClient.invalidateQueries({ queryKey: dailyPickKey(date) }),
  });

  return {
    pick: query.data ?? null,
    loading: query.isPending,
    savePick: save.mutate,
    isSaving: save.isPending,
  };
}
