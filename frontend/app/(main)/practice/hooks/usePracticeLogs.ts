'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PracticeLog } from '@/app/types/index';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';

/**
 * The practice history: past sessions, and the 30-day chart.
 *
 * Read-only apart from editing and deleting a finished session. Starting,
 * pausing and stopping live in `app/hooks/usePracticeSession.ts`, because they
 * belong to the modal, which is mounted for the whole app rather than for this
 * page. This hook used to own all of it, back when /practice *was* the practice
 * screen.
 *
 * Keys nest under a shared prefix so one `invalidateQueries(['practice-logs'])`
 * refreshes the list, the chart *and* the active session. That is a fix, not
 * just tidiness: the chart used to fetch once on mount and never again, so
 * finishing a session left it showing yesterday's totals until a hard reload.
 */
const PRACTICE_LOGS_ROOT = ['practice-logs'] as const;
export const practiceLogsKey = (material?: string) =>
  [...PRACTICE_LOGS_ROOT, 'list', material ?? 'all'] as const;
export const PRACTICE_STATS_KEY = [...PRACTICE_LOGS_ROOT, 'stats'] as const;

interface DayData {
  date: string;
  minutes: number;
}

/** One subject's line on the chart. `key` is its documentId, or a sentinel. */
export interface SubjectStats {
  key: string;
  label: string;
  data: DayData[];
}

interface LogsResponse {
  success?: boolean;
  data?: PracticeLog[];
}

interface StatsResponse {
  success?: boolean;
  data?: SubjectStats[];
}

/**
 * Past sessions, newest first.
 *
 * `material` narrows to one piece; omitting it returns everything, which is what
 * the history page wants — the old signature took a practice *type* and there
 * was no way to ask for the lot.
 */
export function usePracticeLogs(material?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: practiceLogsKey(material),
    queryFn: () =>
      apiFetch<LogsResponse>(
        material
          ? `/api/practice-logs?material=${encodeURIComponent(material)}`
          : '/api/practice-logs'
      ),
    select: (body) => body.data ?? [],
  });

  const logs = useMemo(() => query.data ?? [], [query.data]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: PRACTICE_LOGS_ROOT }),
    [queryClient]
  );

  const updateMutation = useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: unknown }) =>
      apiSend(`/api/practice-logs/${documentId}`, 'PUT', data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiSend(`/api/practice-logs/${documentId}`, 'DELETE'),
    onSuccess: invalidate,
  });

  // The page renders one error banner in place of everything, as before — so a
  // failed read and a failed write both surface the same way.
  const failure = query.error ?? updateMutation.error ?? deleteMutation.error ?? null;

  const update = useCallback(
    async (documentId: string, data: unknown): Promise<void> => {
      await updateMutation.mutateAsync({ documentId, data });
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (documentId: string): Promise<void> => {
      await deleteMutation.mutateAsync(documentId);
    },
    [deleteMutation]
  );

  // There was a `saveNotes` here that deliberately did *not* invalidate, because
  // it wrote what an open editor was holding and a refetch would have handed the
  // editor the server's copy mid-typing. That editor is gone: notes are now
  // edited on a *finished* session through a form that closes on submit, so a
  // refetch afterwards is correct rather than destructive. The general rule it
  // illustrated still stands — see the note in TaskDataContext that cites it.

  return {
    logs,
    loading: query.isPending,
    error: failure ? failure.message : null,

    update,
    remove,
  };
}

export function usePracticeStats() {
  const { data, isPending, error } = useQuery({
    queryKey: PRACTICE_STATS_KEY,
    queryFn: () => apiFetch<StatsResponse>('/api/practice-logs/stats'),
    select: (body) => body.data ?? [],
  });

  return {
    stats: data ?? [],
    loading: isPending,
    error: error ? error.message : null,
  };
}
