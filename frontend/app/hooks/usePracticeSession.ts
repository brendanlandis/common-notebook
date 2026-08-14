'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import type { PracticeLog } from '@/app/types/index';
import { isRunning, parseSegments } from '@/app/lib/practiceSession';

/**
 * The one practice session that is currently open, and the four things you can
 * do to it.
 *
 * Keyed under the existing `['practice-logs']` root so a single invalidate still
 * refreshes the session, the history list and the chart together — stopping a
 * session has to move all three.
 *
 * Deliberately **not** scoped to a material. The modal asks "is anything
 * running?" from /todo and /review, where no material is in scope, so the old
 * per-type query could not answer it — which is also why two sessions on
 * different types used to be able to run at once.
 */
const PRACTICE_LOGS_ROOT = ['practice-logs'] as const;
export const ACTIVE_SESSION_KEY = [...PRACTICE_LOGS_ROOT, 'active'] as const;

interface ActiveResponse {
  success?: boolean;
  data?: PracticeLog | null;
}

/**
 * How often to re-ask while a session is open.
 *
 * Refetching on window focus covers picking a device up, which is the common
 * case. This covers the other one: two devices both awake and looking at the
 * same session, where stopping on the laptop should take the phone's screen down
 * without anyone touching it. Thirty seconds is slow enough to be free and fast
 * enough that the stale screen isn't a lie for long.
 *
 * Only while something is running — a query polling every thirty seconds forever
 * to hear "no, still nothing" is pure waste on every page of the app.
 */
const RUNNING_POLL_MS = 30_000;

export function useActiveSession() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: () => apiFetch<ActiveResponse>('/api/practice-logs/active'),
    select: (body) => body.data ?? null,
    refetchInterval: (q) => (q.state.data?.data ? RUNNING_POLL_MS : false),
  });

  const session = query.data ?? null;

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: PRACTICE_LOGS_ROOT }),
    [queryClient]
  );

  /**
   * Start practising a piece of material.
   *
   * A 409 means something was already running — two tabs, or a session you
   * forgot. The server hands back the open one; invalidating puts it on screen,
   * which is a better answer than an error nobody can act on.
   */
  const startMutation = useMutation({
    mutationFn: (material: string) =>
      apiSend('/api/practice-logs', 'POST', { material }),
    onSettled: invalidate,
  });

  const pauseMutation = useIntentMutation('pause', invalidate);
  const resumeMutation = useIntentMutation('resume', invalidate);
  const stopMutation = useIntentMutation('stop', invalidate);

  const correctMutation = useMutation({
    mutationFn: ({ documentId, minutes }: { documentId: string; minutes: number }) =>
      apiSend(`/api/practice-logs/${documentId}/correct`, 'POST', { minutes }),
    onSettled: invalidate,
  });

  const segments = parseSegments(session?.segments);

  return {
    session,
    segments,
    running: isRunning(segments),
    loading: query.isPending,
    error: query.error ?? startMutation.error ?? stopMutation.error ?? null,

    start: (material: string) => startMutation.mutate(material),
    pause: () => session && pauseMutation.mutate(session.documentId),
    resume: () => session && resumeMutation.mutate(session.documentId),
    stop: () => session && stopMutation.mutate(session.documentId),
    correct: (minutes: number) =>
      session && correctMutation.mutate({ documentId: session.documentId, minutes }),

    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    // Pause and resume are the same control, so the button only needs to know
    // that *something* is in flight.
    isToggling: pauseMutation.isPending || resumeMutation.isPending,
  };
}

/**
 * One of the intent endpoints, as a mutation. All three have the same shape:
 * post the intent, then re-read.
 *
 * `onSettled` rather than `onSuccess` — a failed intent still needs a refetch,
 * because the likeliest reason for one is that the *other* device already moved
 * the session somewhere this one doesn't know about.
 */
function useIntentMutation(name: 'pause' | 'resume' | 'stop', invalidate: () => Promise<void>) {
  return useMutation({
    mutationFn: (documentId: string) =>
      apiSend(`/api/practice-logs/${documentId}/${name}`, 'POST'),
    onSettled: invalidate,
  });
}
