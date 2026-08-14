'use client';

import { useRef } from 'react';
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

  /**
   * Saves, serialized.
   *
   * `/api/daily-picks` is a read-then-write upsert and Strapi has no
   * compare-and-set, so two writes in flight together both find no row for
   * today and both create one — after which the GET takes the first and every
   * later save edits a row nobody reads. The route's own comment called that
   * acceptable on the grounds that a person picking tasks isn't a concurrent
   * workload, and that was true while each pick waited on a round trip before
   * the next was possible. Picking is instant now, so half a dozen picks in a
   * second is the ordinary case rather than the pathological one — exactly the
   * turn that produced a real duplicate in `useSetDecision` within a day.
   *
   * Only the *request* queues; `onMutate` still runs on click. The last write
   * wins, and because it goes last it wins with the whole list.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const save = useMutation({
    mutationFn: (taskIds: string[]) => {
      const next = queue.current
        // A rejected save must not wedge the ones behind it; rollback is per
        // mutation, in onError.
        .catch(() => {})
        .then(() =>
          apiSend<DailyPickResponse>('/api/daily-picks', 'PUT', { date, tasks: taskIds })
        );
      queue.current = next;
      return next;
    },
    // Optimistic, so the cache agrees with what the page is already showing.
    // The row may not exist yet — the first pick of the day creates it — and
    // returning `current` unchanged in that case left the cache claiming today
    // had no pick until the server answered.
    onMutate: async (taskIds) => {
      await queryClient.cancelQueries({ queryKey: dailyPickKey(date) });
      const previous = queryClient.getQueryData<DailyPick | null>(dailyPickKey(date));
      queryClient.setQueryData<DailyPick | null>(dailyPickKey(date), (current) => ({
        // Empty until the server issues one — the same placeholder convention as
        // an optimistic calendar decision. Nothing reads it.
        documentId: current?.documentId ?? '',
        date,
        tasks: taskIds.map((id) => ({ documentId: id }) as Task),
      }));
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
    // Surfaced on the page. The pick is held in local state so it can move the
    // moment it's clicked, which means a failed write leaves the screen looking
    // right and the server disagreeing — and with no button to press, nothing
    // else would ever say so.
    saveError: save.error,
  };
}
