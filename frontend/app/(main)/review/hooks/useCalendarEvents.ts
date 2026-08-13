'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import type { ResolvedInstance } from '@/app/lib/ics/resolveDecisions';

/**
 * The week's calendar events, already resolved server-side.
 *
 * Keys nest under a shared `['calendars']` root so cycling one event's state
 * refreshes the week without a second invalidate.
 */
export const CALENDARS_KEY = ['calendars'] as const;
export const calendarEventsKey = (start: string, end: string) =>
  ['calendars', 'events', start, end] as const;

export interface CalendarSummary {
  documentId: string;
  name: string;
  color: string | null;
  /** The feed could not be fetched — shown as a caveat rather than an error. */
  unreachable: boolean;
}

interface EventsResponse {
  success?: boolean;
  data?: ResolvedInstance[];
  calendars?: CalendarSummary[];
}

export function useCalendarEvents(start: string | null, end: string | null) {
  const query = useQuery({
    queryKey: calendarEventsKey(start ?? '', end ?? ''),
    enabled: start !== null && end !== null,
    queryFn: () => apiFetch<EventsResponse>(`/api/calendars/events?start=${start}&end=${end}`),
    // Each load re-polls every feed, which is several network round trips out to
    // Google. Worth not repeating on every window focus.
    staleTime: 5 * 60_000,
  });

  return {
    events: query.data?.data ?? [],
    calendars: query.data?.calendars ?? [],
    loading: query.isPending,
    error: query.error,
  };
}

/**
 * Set (or clear) one event's state.
 *
 * `state: null` deletes the decision, which is how an instance override is
 * cleared back to inheriting from its series — unset is the absence of a row,
 * not a third value.
 */
export function useSetDecision() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (decision: {
      calendar: string;
      uid: string;
      recurrenceId: string | null;
      state: 'show' | 'hide' | null;
    }) => apiSend('/api/calendars/decisions', 'PUT', decision),
    // No optimistic write. A series-level decision changes the state of every
    // future instance of that event, and reproducing the resolution chain in the
    // client to guess which ones would be a second implementation of the rule
    // that could disagree with the server's. Refetching is one round trip and
    // is always right.
    onSettled: () => queryClient.invalidateQueries({ queryKey: CALENDARS_KEY }),
  });

  return { setDecision: mutation.mutate, isSaving: mutation.isPending, error: mutation.error };
}
