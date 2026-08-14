'use client';

import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import type { ClientCalendar } from '@/app/lib/ics/clientCalendar';
import type { CalendarEventInstance } from '@/app/lib/ics/expandIcs';
import {
  resolveDecisions,
  type ResolvedInstance,
  type StoredDecision,
} from '@/app/lib/ics/resolveDecisions';

/**
 * The week's calendar, as two queries the client resolves together.
 *
 * The split is the whole point. Fetching the events means polling every
 * subscribed ICS feed over the network, server-side, with a ten-second timeout
 * each; fetching the decisions is one query against our own database. They used
 * to be resolved server-side and served as one thing, which meant every click on
 * an event invalidated the expensive query and sat there for several seconds
 * before the state visibly changed — long enough that the only feedback was the
 * undecided counter ticking down.
 *
 * Now a decision writes optimistically into the *decision list*, which is the
 * literal thing being edited, and `resolveDecisions` — pure, unit-tested, and
 * the only implementation of the chain — re-runs in a memo. There is no second
 * copy of the resolution rule to disagree with the first; the feeds are not
 * re-polled; and the new state paints in the same frame as the click.
 *
 * Keys nest under a shared `['calendars']` root so adding or removing a
 * subscription can still invalidate the family in one call.
 */
export const CALENDARS_KEY = ['calendars'] as const;
export const calendarEventsKey = (start: string, end: string) =>
  ['calendars', 'events', start, end] as const;
export const CALENDAR_DECISIONS_KEY = ['calendars', 'decisions'] as const;

export interface CalendarSummary extends ClientCalendar {
  /** The feed could not be fetched — shown as a caveat rather than an error. */
  unreachable: boolean;
}

/** An expanded occurrence, before any decision is applied to it. */
type RawInstance = CalendarEventInstance & { calendarDocumentId: string };

interface EventsResponse {
  success?: boolean;
  data?: RawInstance[];
  calendars?: CalendarSummary[];
}

interface DecisionsResponse {
  success?: boolean;
  data?: StoredDecision[];
}

export function useCalendarEvents(start: string | null, end: string | null) {
  const eventsQuery = useQuery({
    queryKey: calendarEventsKey(start ?? '', end ?? ''),
    enabled: start !== null && end !== null,
    queryFn: () => apiFetch<EventsResponse>(`/api/calendars/events?start=${start}&end=${end}`),
    // Each load re-polls every feed, which is several network round trips out to
    // Google. Worth not repeating on every window focus.
    staleTime: 5 * 60_000,
  });

  const decisionsQuery = useQuery({
    queryKey: CALENDAR_DECISIONS_KEY,
    queryFn: () => apiFetch<DecisionsResponse>('/api/calendars/decisions'),
    staleTime: 5 * 60_000,
  });

  const calendars = useMemo(
    () => eventsQuery.data?.calendars ?? [],
    [eventsQuery.data]
  );

  const events = useMemo(() => {
    const raw = eventsQuery.data?.data ?? [];
    const decisions = decisionsQuery.data?.data ?? [];
    if (raw.length === 0) return [];

    // Resolve per calendar, because both the decision set and the fallback
    // default belong to one. Calendars that returned events but are somehow
    // missing from the summary list still resolve, against `unset` — an event
    // with nowhere to inherit from is undecided, which is the honest answer.
    const byCalendar = new Map<string, RawInstance[]>();
    for (const instance of raw) {
      const group = byCalendar.get(instance.calendarDocumentId);
      if (group) group.push(instance);
      else byCalendar.set(instance.calendarDocumentId, [instance]);
    }

    const resolved: ResolvedInstance[] = [];
    for (const [calendarDocumentId, instances] of byCalendar) {
      const calendar = calendars.find((c) => c.documentId === calendarDocumentId);
      resolved.push(
        ...resolveDecisions(
          instances,
          decisions.filter((d) => d.calendarDocumentId === calendarDocumentId),
          calendarDocumentId,
          calendar?.defaultState ?? 'unset'
        )
      );
    }
    return resolved;
  }, [eventsQuery.data, decisionsQuery.data, calendars]);

  return {
    events,
    calendars,
    loading: eventsQuery.isPending || decisionsQuery.isPending,
    error: eventsQuery.error ?? decisionsQuery.error,
  };
}

interface DecisionInput {
  calendar: string;
  uid: string;
  recurrenceId: string | null;
  state: 'show' | 'hide' | null;
}

/** The row a decision would be stored as, minus the id the server assigns it. */
function asStored(input: DecisionInput): StoredDecision {
  return {
    // Optimistic rows have no documentId yet. Nothing resolves on it — the
    // lookup key is (calendar, uid, recurrenceId) — so a placeholder is honest
    // about that rather than inventing an id the server never issued.
    documentId: '',
    uid: input.uid,
    recurrenceId: input.recurrenceId,
    state: input.state as 'show' | 'hide',
    calendarDocumentId: input.calendar,
  };
}

const sameDecision = (row: StoredDecision, input: DecisionInput) =>
  row.calendarDocumentId === input.calendar &&
  row.uid === input.uid &&
  row.recurrenceId === input.recurrenceId;

/**
 * Set (or clear) one event's state.
 *
 * `state: null` deletes the decision, which is how an instance override is
 * cleared back to inheriting from its series — unset is the absence of a row,
 * not a third value.
 */
export function useSetDecision() {
  const queryClient = useQueryClient();

  /**
   * Decision writes, serialized — and why they have to be.
   *
   * The upsert on the server is read-then-write, and Strapi has no
   * compare-and-set. Two writes for the same event in flight together therefore
   * both read "no row here" and both create one, leaving a permanent duplicate:
   * from then on the handler updates one row while the resolver reads the other,
   * so that event's state reverts on every refetch and cannot be changed from
   * the UI at all. It happened to a real event within a day of shipping this.
   *
   * It was always possible; making the clicks instant is what made it likely.
   * Before that, every click waited on an invalidate that re-polled every ICS
   * feed, which serialized the writes by accident — several seconds of accident.
   *
   * Only the *request* queues. `onMutate` still runs the moment you click, so
   * the pill of an event repaints immediately whether or not an earlier write is
   * still in the air. TanStack's `scope` option would serialize the whole
   * mutation including `onMutate`, which would put the lag straight back.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);

  const mutation = useMutation({
    mutationFn: (decision: DecisionInput) => {
      const next = queue.current
        // A failed write must not wedge every later one; the rollback is
        // handled per-mutation in onError.
        .catch(() => {})
        .then(() => apiSend('/api/calendars/decisions', 'PUT', decision));
      queue.current = next;
      return next;
    },

    /**
     * Written locally first, because the alternative is a click with no visible
     * effect for as long as the round trip takes.
     *
     * This edits the *stored decision list* — add, replace, or remove one row by
     * its (calendar, uid, recurrenceId) key — which is exactly what the server
     * is about to do. It does not guess at resolved states: those fall out of
     * `resolveDecisions` running over the new list, so a series-level decision
     * correctly repaints every instance that was inheriting from it, and
     * correctly leaves alone the ones carrying their own override.
     */
    onMutate: async (decision) => {
      inFlight.current += 1;
      await queryClient.cancelQueries({ queryKey: CALENDAR_DECISIONS_KEY });
      const previous = queryClient.getQueryData<DecisionsResponse>(CALENDAR_DECISIONS_KEY);

      queryClient.setQueryData<DecisionsResponse>(CALENDAR_DECISIONS_KEY, (current) => {
        const rows = current?.data ?? [];
        const without = rows.filter((row) => !sameDecision(row, decision));
        return {
          ...current,
          success: true,
          data: decision.state === null ? without : [...without, asStored(decision)],
        };
      });

      return { previous };
    },

    onError: (_error, _decision, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CALENDAR_DECISIONS_KEY, context.previous);
      }
    },

    /**
     * Refetch once the queue has drained, not after each write.
     *
     * Only the decisions, because invalidating the whole `['calendars']` family
     * would re-poll every ICS feed to learn something none of them can tell us.
     *
     * And only when nothing else is pending: a refetch landing between two
     * queued writes returns the state as of the *first* one and overwrites the
     * second's optimistic value, so a quick second click visibly bounces back
     * before settling. The last write to settle is the one that refreshes.
     */
    onSettled: () => {
      inFlight.current -= 1;
      if (inFlight.current === 0) {
        queryClient.invalidateQueries({ queryKey: CALENDAR_DECISIONS_KEY });
      }
    },
  });

  return { setDecision: mutation.mutate, isSaving: mutation.isPending, error: mutation.error };
}
