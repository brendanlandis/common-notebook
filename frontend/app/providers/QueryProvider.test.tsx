import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/app/lib/apiFetch';
import { makeQueryClient } from './QueryProvider';

const failWith = (status: number) => async () => {
  throw new ApiError(`HTTP ${status}`, status);
};

describe('the query client ends the session on a 401', () => {
  it('clears the cache and goes to /login when a query 401s, without retrying it', async () => {
    const onSessionEnded = vi.fn();
    const client = makeQueryClient({ onSessionEnded });
    client.setQueryData(['tasks', 'active'], ['someone’s tasks']);
    const queryFn = vi.fn(failWith(401));

    await expect(client.fetchQuery({ queryKey: ['me'], queryFn })).rejects.toThrow();

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['tasks', 'active'])).toBeUndefined();
  });

  it('does the same when a mutation 401s', async () => {
    const onSessionEnded = vi.fn();
    const client = makeQueryClient({ onSessionEnded });
    const mutation = client.getMutationCache().build(client, { mutationFn: failWith(401) });

    await expect(mutation.execute(undefined)).rejects.toThrow();
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it('ends it once, however many requests 401 together', async () => {
    const onSessionEnded = vi.fn();
    const client = makeQueryClient({ onSessionEnded });
    await Promise.allSettled([
      client.fetchQuery({ queryKey: ['a'], queryFn: failWith(401) }),
      client.fetchQuery({ queryKey: ['b'], queryFn: failWith(401) }),
    ]);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it('leaves other failures alone, and still retries them once', async () => {
    const onSessionEnded = vi.fn();
    const client = makeQueryClient({ onSessionEnded });
    client.setQueryData(['tasks', 'active'], ['kept']);

    await expect(
      client.fetchQuery({ queryKey: ['me'], queryFn: failWith(500), retryDelay: 0 })
    ).rejects.toThrow();

    expect(onSessionEnded).not.toHaveBeenCalled();
    expect(client.getQueryData(['tasks', 'active'])).toEqual(['kept']);
    const retry = client.getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, new ApiError('HTTP 500', 500))).toBe(true);
    expect(retry(1, new ApiError('HTTP 500', 500))).toBe(false);
    expect(retry(0, new ApiError('HTTP 401', 401))).toBe(false);
  });
});
