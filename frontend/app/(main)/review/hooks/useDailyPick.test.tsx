import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import { useDailyPick } from './useDailyPick';

/**
 * Today's pick, saved a click at a time.
 *
 * The page holds the selection in local state so a task moves the instant it's
 * clicked, and this hook writes behind it. That's the whole reason for both
 * things asserted here: picking is no longer paced by the network, so several
 * saves can be in the air at once, and the endpoint they hit is a read-then-write
 * upsert against a store with no compare-and-set.
 */

vi.mock('@/app/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
  apiSend: vi.fn(),
}));

const DATE = '2026-01-14';

/** Rows the fake server holds, keyed by date — one per date, as the route says. */
let rows: Record<string, { documentId: string; date: string; tasks: { documentId: string }[] }>;
/** How many writes are mid-flight, and the high-water mark of that. */
let inFlight: number;
let peakInFlight: number;
/** Resolves the next write, so a test can hold one open. */
let release: (() => void) | null;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  rows = {};
  inFlight = 0;
  peakInFlight = 0;
  release = null;

  (apiFetch as Mock).mockImplementation(async (url: string) => {
    if (url.startsWith('/api/daily-picks')) {
      const date = new URL(url, 'http://x').searchParams.get('date') ?? '';
      return { success: true, data: rows[date] ?? null };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });

  // Stands in for the route: find the row for this date, else create one. The
  // lookup and the write are two steps, which is exactly the shape that turns
  // overlapping requests into duplicate rows.
  (apiSend as Mock).mockImplementation(
    async (_url: string, _method: string, body: Record<string, unknown>) => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      const date = body.date as string;
      const existing = rows[date];

      await new Promise<void>((resolve) => {
        release = () => resolve();
        // Held open only when a test grabs `release` before this resolves.
        queueMicrotask(() => release?.());
      });

      rows[date] = {
        documentId: existing?.documentId ?? 'pick-1',
        date,
        tasks: (body.tasks as string[]).map((documentId) => ({ documentId })),
      };
      inFlight -= 1;
      return { success: true, data: rows[date] };
    }
  );
});

describe('useDailyPick', () => {
  it('writes optimistically even when today has no pick yet', async () => {
    // The first pick of the day *creates* the row. The obvious updater returns
    // `current` untouched when there is none — leaving the cache insisting the
    // day is unpicked until the server answers.
    const { result } = renderHook(() => useDailyPick(DATE), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pick).toBeNull();

    act(() => result.current.savePick(['task-a']));

    await waitFor(() =>
      expect(result.current.pick?.tasks.map((task) => task.documentId)).toEqual(['task-a'])
    );
  });

  it('never has two writes in flight at once', async () => {
    // Three picks in a row, faster than the network. Unserialized, all three
    // read "no row for today" and all three create one; from then on the GET
    // takes the first and every later save edits a row nobody reads.
    const { result } = renderHook(() => useDailyPick(DATE), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.savePick(['a']);
      result.current.savePick(['a', 'b']);
      result.current.savePick(['a', 'b', 'c']);
    });

    await waitFor(() => expect(result.current.isSaving).toBe(false));
    expect(peakInFlight).toBe(1);
  });

  it('settles on the last pick, with the whole list', async () => {
    // Serialized writes are only useful if the last one to leave is the last one
    // to land: each save carries the entire selection, so the final row is the
    // final state rather than an accumulation of three.
    const { result } = renderHook(() => useDailyPick(DATE), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.savePick(['a']);
      result.current.savePick(['a', 'b']);
      result.current.savePick(['b']);
    });

    await waitFor(() => expect(result.current.isSaving).toBe(false));
    expect(rows[DATE].tasks.map((task) => task.documentId)).toEqual(['b']);
    expect(rows[DATE].documentId).toBe('pick-1');
  });

  it('reports a failed save rather than swallowing it', async () => {
    // Nothing else would say so: the page moves the task on click and there is
    // no button to watch.
    (apiSend as Mock).mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useDailyPick(DATE), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.savePick(['a']));

    await waitFor(() => expect(result.current.saveError?.message).toBe('nope'));
  });

  it('rolls the cache back when a save fails', async () => {
    (apiSend as Mock).mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useDailyPick(DATE), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.savePick(['a']));

    await waitFor(() => expect(result.current.saveError).toBeTruthy());
    expect(result.current.pick).toBeNull();
  });
});
