import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PracticeLog } from '@/app/types/index';
import { usePracticeLogs, usePracticeStats } from './usePracticeLogs';

/**
 * The practice *history*. Starting, pausing and stopping moved out to
 * `app/hooks/usePracticeSession.ts` when the practice screen became a modal, so
 * the tests for those live with the intent routes and the modal.
 *
 * Two things this file used to assert and deliberately no longer does:
 *
 * - **the active session.** It was derived here as "the log with no stop", among
 *   *one type's* logs — which is exactly why two sessions on different types
 *   could both be open. It is a server query now, and not scoped to a material.
 * - **that saving notes does not refetch.** True while /practice held a live
 *   editor over an open session; a refetch mid-typing would have handed it the
 *   server's copy. Notes are edited on a finished session through a form that
 *   closes on submit, so refetching afterwards is correct.
 */

const makeLog = (documentId: string, stop: string | null): PracticeLog =>
  ({
    id: 1,
    documentId,
    start: '2026-01-08T10:00:00.000Z',
    stop,
    segments: [{ start: '2026-01-08T10:00:00.000Z', stop }],
    notes: [],
    duration: stop ? 30 : 0,
    date: '2026-01-08',
    createdAt: '',
    updatedAt: '',
    publishedAt: '',
  }) as unknown as PracticeLog;

const STATS_URL = '/api/practice-logs/stats';
const ALL_URL = '/api/practice-logs';
const callsTo = (mock: ReturnType<typeof vi.fn>, url: string) =>
  mock.mock.calls.filter((c) => c[0] === url).length;

/**
 * Mirrors the app's `staleTime` (QueryProvider) because the cache hit asserted
 * below is a product of it — a bare client defaults to 0 and would refetch on
 * every remount, testing a configuration the app doesn't run. `retry: false` is
 * the one deliberate divergence: the app's 1 would make each failure case wait
 * out a backoff.
 */
function makeHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('usePracticeLogs', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url === STATS_URL
          ? okJson({ success: true, data: [{ key: 'subject-1', label: 'guitar', data: [] }] })
          : okJson({ success: true, data: [makeLog('done-1', '2026-01-08T10:30:00.000Z')] })
      )
    );
    global.fetch = fetchMock as any;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('asks for every session when given no material', async () => {
    // The history page wants the lot. The old signature took a practice type and
    // there was no way to express "all of them".
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => usePracticeLogs(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callsTo(fetchMock, ALL_URL)).toBe(1);
    expect(result.current.logs).toHaveLength(1);
  });

  it('keys the query by material, and serves a revisit from cache', async () => {
    const { wrapper } = makeHarness();
    const { result, rerender } = renderHook(({ material }) => usePracticeLogs(material), {
      wrapper,
      initialProps: { material: 'material-a' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callsTo(fetchMock, `${ALL_URL}?material=material-a`)).toBe(1);

    rerender({ material: 'material-b' });
    await waitFor(() =>
      expect(callsTo(fetchMock, `${ALL_URL}?material=material-b`)).toBe(1)
    );

    rerender({ material: 'material-a' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callsTo(fetchMock, `${ALL_URL}?material=material-a`)).toBe(1);
  });

  it('editing a session also refreshes the chart', async () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(
      () => ({ logs: usePracticeLogs(), stats: usePracticeStats() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.logs.loading).toBe(false));
    await waitFor(() => expect(result.current.stats.loading).toBe(false));
    const before = callsTo(fetchMock, STATS_URL);

    await act(async () => {
      await result.current.logs.update('done-1', { notes: [] });
    });

    // The chart used to fetch once on mount and never again, so changing a
    // session left it showing stale totals until a hard reload. The shared
    // `['practice-logs']` prefix is what makes one invalidate cover both.
    await waitFor(() => expect(callsTo(fetchMock, STATS_URL)).toBeGreaterThan(before));
  });

  it('deleting a session also refreshes the chart', async () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(
      () => ({ logs: usePracticeLogs(), stats: usePracticeStats() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.logs.loading).toBe(false));
    await waitFor(() => expect(result.current.stats.loading).toBe(false));
    const before = callsTo(fetchMock, STATS_URL);

    await act(async () => {
      await result.current.logs.remove('done-1');
    });

    await waitFor(() => expect(callsTo(fetchMock, STATS_URL)).toBeGreaterThan(before));
  });

  it('surfaces a failed read as an error message', async () => {
    // `apiFetch` throws on a 500 *and* on a `{success:false}` body. A raw fetch
    // would resolve and leave a successful query holding undefined.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'boom' }),
    });
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => usePracticeLogs(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.logs).toEqual([]);
  });
});

describe('usePracticeStats', () => {
  it('reads the subject series the route returns', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [{ key: 'subject-1', label: 'guitar', data: [{ date: '2026-01-08', minutes: 30 }] }],
      }),
    });
    global.fetch = fetchMock as any;

    const { wrapper } = makeHarness();
    const { result } = renderHook(() => usePracticeStats(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toEqual([
      { key: 'subject-1', label: 'guitar', data: [{ date: '2026-01-08', minutes: 30 }] },
    ]);
  });
});
