/**
 * The bridge between this app's BFF convention and TanStack Query's.
 *
 * Every `app/api/*` handler answers `{ success: boolean, ... }`, and `fetch` does
 * not reject on 4xx/5xx. TanStack treats any resolved promise as success, so a
 * query calling `fetch` directly would turn every error — an expired session, a
 * 500, a `{success:false}` body — into a *successful* query holding `undefined`.
 * The UI would render an empty list instead of an error, silently.
 *
 * So: throw on both failure shapes, and hand back the parsed body. Query and
 * mutation functions must go through this rather than calling `fetch` themselves.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiBody {
  success?: boolean;
  error?: string;
}

/**
 * Fetch one of this app's API routes, throwing unless it reports success.
 *
 * @returns the parsed response body — callers pick `.data`, `.value`, etc., since
 *   the routes are not uniform about the payload key.
 */
export async function apiFetch<T extends ApiBody = ApiBody>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, init);

  let body: T | null = null;
  let parsed = false;
  try {
    body = (await response.json()) as T;
    parsed = true;
  } catch {
    // Leave `parsed` false — what to do about it depends on the status.
  }

  if (!response.ok) {
    throw new ApiError(body?.error ?? response.statusText ?? 'Request failed', response.status);
  }

  // Belt and braces: a handler that reports failure in a 200 body would otherwise
  // sail through as a successful query.
  if (body?.success === false) {
    throw new ApiError(body.error ?? 'Request failed', response.status);
  }

  // Every route in this app answers with `NextResponse.json`, so a 2xx we could not
  // parse is a broken handler or something that isn't our API at all. Returning `{}`
  // here would type an empty object as `T` and hand the caller `data: undefined`
  // where it reads `Task[]` — the same silent-empty-list failure this file exists to
  // prevent, only sneaking in through the success path.
  if (!parsed) {
    throw new ApiError('Response was not valid JSON', response.status);
  }

  return body as T;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** `apiFetch` with a JSON body. */
export function apiSend<T extends ApiBody = ApiBody>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T> {
  return apiFetch<T>(path, {
    method,
    ...(body === undefined ? {} : { headers: JSON_HEADERS, body: JSON.stringify(body) }),
  });
}

/**
 * Await a mutation, logging and swallowing any failure.
 *
 * `mutateAsync` rejects, and these callers don't catch — an unhandled rejection
 * is worse than the pre-existing behaviour, which was to log and carry on. When a
 * screen grows real error UI it should read `useMutation`'s `error` instead of
 * going through here.
 */
export async function swallow(what: string, work: Promise<unknown>): Promise<void> {
  try {
    await work;
  } catch (e) {
    console.error(`Failed to ${what}:`, e);
  }
}
