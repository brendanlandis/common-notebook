import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { World } from '@/app/types/index';
import { useWorlds } from './useWorlds';

/**
 * The reorder rollback is the capability the hand-rolled context did not have:
 * it set the new order optimistically, fired N PUTs, and if they failed left the
 * wrong order on screen until the unconditional trailing refetch happened to fix
 * it. `onMutate`/`onError` put the old order back.
 */
const makeWorld = (documentId: string, position: number): World =>
  ({
    id: position,
    documentId,
    title: documentId,
    position,
    systemKey: null,
    createdAt: '',
    updatedAt: '',
    publishedAt: '',
  }) as unknown as World;

// A fresh client per test, and `retry: false` — the app default of 1 would make
// every failure case sit through a backoff before the assertion could run.
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useWorlds', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const worldsBody = () => ({
    success: true,
    data: [makeWorld('a', 0), makeWorld('b', 1), makeWorld('c', 2)],
  });

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => worldsBody(),
    });
    global.fetch = fetchMock as any;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('loads worlds sorted by position', async () => {
    const { result } = renderHook(() => useWorlds(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.worlds.map((w) => w.documentId)).toEqual(['a', 'b', 'c']);
  });

  it('shows the new order immediately while the PUTs are in flight', async () => {
    const { result } = renderHook(() => useWorlds(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Never-resolving PUTs: the optimistic order must be visible regardless.
    fetchMock.mockImplementation(() => new Promise(() => {}));

    act(() => {
      void result.current.reorderWorlds(['c', 'a', 'b']);
    });

    await waitFor(() =>
      expect(result.current.worlds.map((w) => w.documentId)).toEqual(['c', 'a', 'b'])
    );
  });

  it('rolls the order back when the PUTs fail', async () => {
    const { result } = renderHook(() => useWorlds(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Every PUT fails, and so does the refetch that onSettled triggers — so the
    // only thing that can restore the order is the rollback itself.
    fetchMock.mockRejectedValue(new TypeError('offline'));

    await act(async () => {
      await result.current.reorderWorlds(['c', 'a', 'b']);
    });

    expect(result.current.worlds.map((w) => w.documentId)).toEqual(['a', 'b', 'c']);
  });

  it('swallows a failed create rather than rejecting', async () => {
    const { result } = renderHook(() => useWorlds(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ success: false, error: 'boom' }),
    });

    // Callers don't try/catch, so a rejection here would surface as an unhandled
    // rejection. The pre-TanStack contract was to log and carry on.
    await act(async () => {
      await expect(result.current.createWorld({ title: 'new' })).resolves.toBeUndefined();
    });
    expect(console.error).toHaveBeenCalled();
  });
});
