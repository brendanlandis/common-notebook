'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PracticeLog, PracticeType, StrapiBlock } from '@/app/types/index';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';

// Practice logs for one practice type, plus the 30-day chart data.
//
// Keys nest under a shared prefix so one `invalidateQueries(['practice-logs'])`
// refreshes the mounted list *and* the chart. That is a fix, not just tidiness:
// the chart used to fetch once on mount and never again, so finishing a session
// left it showing yesterday's totals until a hard reload.
const PRACTICE_LOGS_ROOT = ['practice-logs'] as const;
export const practiceLogsKey = (type: string) => [...PRACTICE_LOGS_ROOT, 'list', type] as const;
export const PRACTICE_STATS_KEY = [...PRACTICE_LOGS_ROOT, 'stats'] as const;

interface DayData {
  date: string;
  minutes: number;
}

export interface TypeStats {
  type: PracticeType;
  data: DayData[];
}

interface LogsResponse {
  success?: boolean;
  data?: PracticeLog[];
}

/**
 * The body `POST /api/practice-logs` accepts.
 *
 * Not `Partial<PracticeLog>`: `type` is a plain `string` here because
 * `PracticeContext.selectedPracticeType` is typed that way, and the route
 * validates it server-side. The old code sent this same shape through an untyped
 * `JSON.stringify`, so the mismatch never surfaced.
 */
export interface NewPracticeLog {
  start: string;
  stop: string | null;
  type: string;
  notes: StrapiBlock[];
  duration: number;
  date: string;
}

interface StatsResponse {
  success?: boolean;
  data?: TypeStats[];
}

export function usePracticeLogs(type: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: practiceLogsKey(type),
    queryFn: () =>
      apiFetch<LogsResponse>(`/api/practice-logs?type=${encodeURIComponent(type)}`),
    select: (body) => body.data ?? [],
  });

  const logs = useMemo(() => query.data ?? [], [query.data]);

  // The one session without a stop time. Derived rather than stored — it was a
  // second piece of state kept in sync by hand before.
  const activeSession = useMemo(() => logs.find((log) => !log.stop) ?? null, [logs]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: PRACTICE_LOGS_ROOT }),
    [queryClient]
  );

  const startMutation = useMutation({
    mutationFn: (log: NewPracticeLog) => apiSend('/api/practice-logs', 'POST', log),
    onSuccess: invalidate,
  });

  const stopMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiSend(`/api/practice-logs/${documentId}/stop`, 'POST'),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: unknown }) =>
      apiSend(`/api/practice-logs/${documentId}`, 'PUT', data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiSend(`/api/practice-logs/${documentId}`, 'DELETE'),
    onSuccess: invalidate,
  });

  // Notes save deliberately does NOT invalidate. The editor is a controlled
  // component holding the user's in-progress text; refetching mid-session would
  // hand it back the server's copy and drop whatever was typed since. The server
  // has the value, the cache converges on the next real refetch, and nothing
  // reads notes off the cache while a session is open.
  const notesMutation = useMutation({
    mutationFn: ({ documentId, notes }: { documentId: string; notes: StrapiBlock[] }) =>
      apiSend(`/api/practice-logs/${documentId}`, 'PUT', { notes }),
  });

  // The page renders one error banner in place of everything, as before — so a
  // failed read and a failed write both surface the same way.
  const failure =
    query.error ??
    startMutation.error ??
    stopMutation.error ??
    updateMutation.error ??
    deleteMutation.error ??
    null;

  // The mutations resolve to void: no caller reads a response body, and
  // PracticeSessionItem's props require `Promise<void>` handlers.
  const start = useCallback(
    async (log: NewPracticeLog): Promise<void> => {
      await startMutation.mutateAsync(log);
    },
    [startMutation]
  );

  const stop = useCallback(
    async (documentId: string): Promise<void> => {
      await stopMutation.mutateAsync(documentId);
    },
    [stopMutation]
  );

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

  const saveNotes = useCallback(
    async (documentId: string, notes: StrapiBlock[]): Promise<void> => {
      await notesMutation.mutateAsync({ documentId, notes });
    },
    [notesMutation]
  );

  return {
    logs,
    activeSession,
    loading: query.isPending,
    error: failure ? failure.message : null,

    start,
    stop,
    update,
    remove,
    saveNotes,

    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isSavingNotes: notesMutation.isPending,
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
