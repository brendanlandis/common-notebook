import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PracticeLog } from '@/app/types/index';
import { usePracticeLogs, usePracticeStats } from './usePracticeLogs';

const makeLog = (documentId: string, stop: string | null): PracticeLog =>
  ({
    id: 1,
    documentId,
    start: '2026-01-08T10:00:00.000Z',
    stop,
    type: 'guitar',
    notes: [],
    duration: stop ? 30 : 0,
    date: '2026-01-08',
    createdAt: '',
    updatedAt: '',
    publishedAt: '',
  }) as unknown as PracticeLog;

const STATS_URL = '/api/practice-logs/stats';
const callsTo = (mock: ReturnType<typeof vi.fn>, url: string) =>
  mock.mock.calls.filter((c) => c[0] === url).length;

/**
 * Mirrors the app's `staleTime` (QueryProvider) because the per-type cache hit
 * asserted below is a product of it — a bare client defaults to 0 and would
 * refetch on every remount, testing a configuration the app doesn't run.
 * `retry: false` is the one deliberate divergence: the app's 1 would make each
 * failure case wait out a backoff.
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
          ? okJson({ success: true, data: [{ type: 'guitar', data: [] }] })
          : okJson({ success: true, data: [makeLog('open-1', null)] })
      )
    );
    global.fetch = fetchMock as any;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('derives the active session as the log with no stop time', async () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => usePracticeLogs('guitar'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeSession?.documentId).toBe('open-1');
  });

  it('has no active session when every log is stopped', async () => {
    fetchMock.mockResolvedValue(
      okJson({ success: true, data: [makeLog('done-1', '2026-01-08T10:30:00.000Z')] })
    );
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => usePracticeLogs('guitar'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeSession).toBeNull();
  });

  it('keys the query by practice type, and serves a revisit from cache', async () => {
    const { wrapper } = makeHarness();
    const { result, rerender } = renderHook(({ type }) => usePracticeLogs(type), {
      wrapper,
      initialProps: { type: 'guitar' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callsTo(fetchMock, '/api/practice-logs?type=guitar')).toBe(1);

    rerender({ type: 'voice' });
    await waitFor(() => expect(callsTo(fetchMock, '/api/practice-logs?type=voice')).toBe(1));

    // Switching back is served from cache — the old code refetched every time
    // `selectedPracticeType` changed, in both directions.
    rerender({ type: 'guitar' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callsTo(fetchMock, '/api/practice-logs?type=guitar')).toBe(1);
  });

  it('stopping a session also refreshes the chart data', async () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(
      () => ({ logs: usePracticeLogs('guitar'), stats: usePracticeStats() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.logs.loading).toBe(false));
    await waitFor(() => expect(result.current.stats.loading).toBe(false));
    const before = callsTo(fetchMock, STATS_URL);

    await act(async () => {
      await result.current.logs.stop('open-1');
    });

    // The chart used to fetch once on mount and never again, so finishing a
    // session left it showing stale totals until a hard reload.
    await waitFor(() => expect(callsTo(fetchMock, STATS_URL)).toBeGreaterThan(before));
  });

  it('saving notes does NOT refetch — that would clobber the open editor', async () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(
      () => ({ logs: usePracticeLogs('guitar'), stats: usePracticeStats() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.logs.loading).toBe(false));
    await waitFor(() => expect(result.current.stats.loading).toBe(false));

    const listBefore = callsTo(fetchMock, '/api/practice-logs?type=guitar');
    const statsBefore = callsTo(fetchMock, STATS_URL);

    await act(async () => {
      await result.current.logs.saveNotes('open-1', []);
    });

    // The editor holds the user's in-progress text; a refetch here would hand it
    // back the server's copy and drop whatever was typed since the last save.
    expect(callsTo(fetchMock, '/api/practice-logs?type=guitar')).toBe(listBefore);
    expect(callsTo(fetchMock, STATS_URL)).toBe(statsBefore);
  });

  it('surfaces a failed read as an error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ success: false, error: 'boom' }),
    });
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => usePracticeLogs('guitar'), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
  });
});
