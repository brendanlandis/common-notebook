import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiFetch, apiSend, ApiError } from './apiFetch';

/**
 * The adapter is the whole reason TanStack can be trusted with these routes:
 * `fetch` resolves on a 401 and the handlers answer `{success:false}`, so without
 * a throw here every failure would land as a *successful* query holding
 * `undefined` and the UI would render an empty list instead of an error.
 */
describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });

  const response = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body }) as Response;

  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValueOnce(response({ success: true, data: [{ id: 1 }] }));
    await expect(apiFetch('/api/views')).resolves.toEqual({ success: true, data: [{ id: 1 }] });
  });

  it('throws on a non-2xx even though fetch resolved', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ success: false, error: 'Unauthorized' }, false, 401)
    );
    await expect(apiFetch('/api/views')).rejects.toBeInstanceOf(ApiError);
  });

  it('carries the status on the error, so a 401 is distinguishable', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ success: false, error: 'Unauthorized' }, false, 401)
    );
    await expect(apiFetch('/api/views')).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
    });
  });

  it('throws on {success:false} even in a 200 body', async () => {
    fetchMock.mockResolvedValueOnce(response({ success: false, error: 'Nope' }, true, 200));
    await expect(apiFetch('/api/views')).rejects.toMatchObject({ message: 'Nope' });
  });

  it('throws when the body is not JSON and the status is bad', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response);
    await expect(apiFetch('/api/views')).rejects.toMatchObject({ status: 500 });
  });

  it('propagates a network rejection', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiFetch('/api/views')).rejects.toThrow('Failed to fetch');
  });

  /**
   * Every route answers with `NextResponse.json`, so an unparseable 2xx is a broken
   * handler. This used to return `{}` typed as `T`, which handed the caller
   * `data: undefined` while TypeScript read `Task[]` — the silent empty list, arriving
   * through the success path instead of the error path.
   */
  it('throws on a 2xx whose body is not JSON, rather than fabricating an empty object', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    } as unknown as Response);

    await expect(apiFetch('/api/tasks')).rejects.toMatchObject({
      status: 200,
      message: 'Response was not valid JSON',
    });
  });
});

describe('apiSend', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });

  it('sends JSON with the content-type header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) } as Response);
    await apiSend('/api/views/abc', 'PUT', { position: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/views/abc');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ position: 2 });
  });

  it('omits the body and headers when there is nothing to send', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) } as Response);
    await apiSend('/api/views/abc', 'DELETE');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });
});
