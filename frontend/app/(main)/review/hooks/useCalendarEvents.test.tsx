import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import { useCalendarEvents, useSetDecision } from './useCalendarEvents';
import type { StoredDecision } from '@/app/lib/ics/resolveDecisions';

/**
 * The events and the decisions are two queries the client resolves together,
 * and this is the suite that says why.
 *
 * Fetching the events polls every subscribed ICS feed over the network;
 * fetching the decisions hits our own database. When they were one server-side
 * request, clicking an event invalidated the expensive one and the state took
 * seconds to visibly change. So there are two claims to hold onto:
 *
 *  1. A decision paints immediately, through the *real* resolution chain rather
 *     than a client-side guess at it.
 *  2. Writing one does not re-poll the feeds.
 */

vi.mock('@/app/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
  apiSend: vi.fn(),
}));

const PERIOD = ['2026-01-12', '2026-01-18'] as const;

const CALENDARS = [
  {
    documentId: 'cal-1',
    name: 'work',
    color: null,
    position: 0,
    defaultState: 'unset' as const,
    hasUrl: true,
    unreachable: false,
  },
];

/** A weekly standup: three instances of one series, one of them overridden. */
const EVENTS = [
  {
    uid: 'standup@test',
    recurrenceId: '2026-01-12T09:00:00',
    title: 'standup',
    allDay: false,
    start: '2026-01-12T09:00:00',
    end: '2026-01-12T09:15:00',
    calendarDocumentId: 'cal-1',
  },
  {
    uid: 'standup@test',
    recurrenceId: '2026-01-13T09:00:00',
    title: 'standup',
    allDay: false,
    start: '2026-01-13T09:00:00',
    end: '2026-01-13T09:15:00',
    calendarDocumentId: 'cal-1',
  },
  {
    uid: 'standup@test',
    recurrenceId: '2026-01-14T09:00:00',
    title: 'standup',
    allDay: false,
    start: '2026-01-14T09:00:00',
    end: '2026-01-14T09:15:00',
    calendarDocumentId: 'cal-1',
  },
];

let decisions: StoredDecision[] = [];
let eventsCalls = 0;

function wrapper({ children }: { children: React.ReactNode }) {
  // Per-test client, and `retry: false` so a failure case asserts immediately
  // instead of sitting through a backoff.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setup() {
  return renderHook(
    () => ({ read: useCalendarEvents(...PERIOD), write: useSetDecision() }),
    { wrapper }
  );
}

const stateOf = (
  events: ReturnType<typeof useCalendarEvents>['events'],
  recurrenceId: string
) => events.find((event) => event.recurrenceId === recurrenceId)?.state;

beforeEach(() => {
  decisions = [];
  eventsCalls = 0;

  (apiFetch as Mock).mockImplementation(async (url: string) => {
    if (url.startsWith('/api/calendars/events')) {
      eventsCalls += 1;
      return { success: true, data: EVENTS, calendars: CALENDARS };
    }
    if (url === '/api/calendars/decisions') {
      return { success: true, data: decisions };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });

  // Stands in for the server's upsert, so the refetch that follows a write
  // converges on the same answer the optimistic write already showed.
  (apiSend as Mock).mockImplementation(
    async (_url: string, _method: string, body: Record<string, unknown>) => {
      decisions = decisions.filter(
        (row) =>
          !(
            row.calendarDocumentId === body.calendar &&
            row.uid === body.uid &&
            row.recurrenceId === body.recurrenceId
          )
      );
      if (body.state !== null) {
        decisions = [
          ...decisions,
          {
            documentId: 'saved',
            uid: body.uid as string,
            recurrenceId: body.recurrenceId as string | null,
            state: body.state as 'show' | 'hide',
            calendarDocumentId: body.calendar as string,
          },
        ];
      }
      return { success: true };
    }
  );
});

describe('useCalendarEvents', () => {
  it('resolves stored decisions client-side', async () => {
    decisions = [
      {
        documentId: 'd-1',
        uid: 'standup@test',
        recurrenceId: null,
        state: 'hide',
        calendarDocumentId: 'cal-1',
      },
    ];

    const { result } = setup();

    await waitFor(() => expect(result.current.read.events).toHaveLength(3));
    expect(result.current.read.events.every((e) => e.state === 'hide')).toBe(true);
    expect(result.current.read.events.every((e) => e.source === 'series')).toBe(true);
  });

  it('falls back to the calendar default', async () => {
    // The tier below the series, and the one the client could only apply after
    // the calendars' own defaults started coming down with the events.
    (apiFetch as Mock).mockImplementation(async (url: string) =>
      url.startsWith('/api/calendars/events')
        ? {
            success: true,
            data: EVENTS,
            calendars: [{ ...CALENDARS[0], defaultState: 'show' as const }],
          }
        : { success: true, data: [] }
    );

    const { result } = setup();

    await waitFor(() => expect(result.current.read.events).toHaveLength(3));
    expect(result.current.read.events.every((e) => e.state === 'show')).toBe(true);
    expect(result.current.read.events.every((e) => e.source === 'calendar')).toBe(true);
  });

  it('paints a series decision across every inheriting instance at once', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.read.events).toHaveLength(3));
    expect(result.current.read.events.every((e) => e.state === 'unset')).toBe(true);

    act(() =>
      result.current.write.setDecision({
        calendar: 'cal-1',
        uid: 'standup@test',
        recurrenceId: null,
        state: 'hide',
      })
    );

    // The cache write lands on a microtask, so this needs waitFor — but it must
    // not need the mutation's round trip.
    await waitFor(() =>
      expect(result.current.read.events.every((e) => e.state === 'hide')).toBe(true)
    );
  });

  it('leaves an instance override alone when the series changes', async () => {
    // The reason the optimistic write edits the decision *list* rather than the
    // resolved states: this rule is `resolveDecisions`', and there is only one
    // copy of it.
    decisions = [
      {
        documentId: 'd-1',
        uid: 'standup@test',
        recurrenceId: '2026-01-13T09:00:00',
        state: 'show',
        calendarDocumentId: 'cal-1',
      },
    ];

    const { result } = setup();
    await waitFor(() => expect(result.current.read.events).toHaveLength(3));

    act(() =>
      result.current.write.setDecision({
        calendar: 'cal-1',
        uid: 'standup@test',
        recurrenceId: null,
        state: 'hide',
      })
    );

    await waitFor(() =>
      expect(stateOf(result.current.read.events, '2026-01-12T09:00:00')).toBe('hide')
    );
    expect(stateOf(result.current.read.events, '2026-01-13T09:00:00')).toBe('show');
  });

  it('never re-polls the feeds to change a decision', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.read.events).toHaveLength(3));
    expect(eventsCalls).toBe(1);

    act(() =>
      result.current.write.setDecision({
        calendar: 'cal-1',
        uid: 'standup@test',
        recurrenceId: null,
        state: 'show',
      })
    );

    await waitFor(() => expect(apiSend).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.read.events.every((e) => e.state === 'show')).toBe(true)
    );

    // The whole point of splitting the two queries. Invalidating the
    // `['calendars']` family instead would fan back out to every ICS feed.
    expect(eventsCalls).toBe(1);
  });

  it('puts the old state back when the write fails', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.read.events).toHaveLength(3));

    (apiSend as Mock).mockRejectedValueOnce(new Error('nope'));

    act(() =>
      result.current.write.setDecision({
        calendar: 'cal-1',
        uid: 'standup@test',
        recurrenceId: null,
        state: 'hide',
      })
    );

    await waitFor(() => expect(result.current.write.error).toBeTruthy());
    await waitFor(() =>
      expect(result.current.read.events.every((e) => e.state === 'unset')).toBe(true)
    );
  });
});
