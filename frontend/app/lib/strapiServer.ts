/**
 * Server-side helpers for talking to Strapi.
 *
 * The point of this module is `fetchAllPages`. Strapi clamps `pagination[pageSize]`
 * to `maxLimit` (100, see `backend/config/api.ts`) and says nothing about it, so a
 * handler asking for `pageSize=1000` silently receives the first 100 rows and
 * computes a wrong answer. Three handlers were doing exactly that. Never request
 * more than one page's worth; page until `pageCount` is exhausted.
 */

const STRAPI_API_URL = process.env.STRAPI_API_URL;

/** `maxLimit` in backend/config/api.ts. Asking for more is silently clamped. */
export const STRAPI_MAX_PAGE_SIZE = 100;

/** A runaway loop would hammer Strapi; 500 pages is 50k rows. */
const MAX_PAGES = 500;

export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

function withQuery(path: string, params: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${params}`;
}

export async function strapiFetch(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${STRAPI_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
}

/**
 * Fetch every row matching `path`, paging until Strapi says there are no more.
 *
 * `path` is a Strapi API path with any filters/sort already applied and *no*
 * pagination params — those are added here.
 *
 * Throws on a non-OK response rather than returning a short list: a truncated
 * result that looks successful is how the silent-clamp bug happened.
 */
export async function fetchAllPages<T = unknown>(token: string, path: string): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = withQuery(path, `pagination[pageSize]=${STRAPI_MAX_PAGE_SIZE}&pagination[page]=${page}`);
    const response = await strapiFetch(token, url);

    if (!response.ok) {
      throw new Error(`Strapi ${response.status} for ${path} (page ${page})`);
    }

    const body = await response.json();
    rows.push(...(body.data ?? []));

    const pagination: StrapiPagination | undefined = body.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) return rows;
  }

  throw new Error(`fetchAllPages exceeded ${MAX_PAGES} pages for ${path}`);
}

export interface SystemSetting {
  documentId: string;
  title: string;
  date: string | null;
  value: string | null;
}

/**
 * Read one of the caller's system settings. Returns null when they have none —
 * which is the normal state for a brand-new account, since settings are
 * per-user now.
 */
export async function getSystemSetting(
  token: string,
  title: string
): Promise<SystemSetting | null> {
  const response = await strapiFetch(
    token,
    `/api/system-settings?filters[title][$eq]=${encodeURIComponent(title)}`
  );
  if (!response.ok) return null;

  const body = await response.json();
  const setting = body.data?.[0];
  if (!setting) return null;

  return {
    documentId: setting.documentId,
    title: setting.title,
    // Strapi may hand back a full timestamp where the app wants YYYY-MM-DD.
    date: setting.date ? String(setting.date).split('T')[0].split(' ')[0] : null,
    value: setting.value ?? null,
  };
}

/** Create or update one of the caller's settings. The owner is stamped by the backend. */
export async function upsertSystemSetting(
  token: string,
  title: string,
  fields: { date?: string; value?: string }
): Promise<boolean> {
  const existing = await getSystemSetting(token, title);
  const body = JSON.stringify({ data: { title, ...fields } });
  const headers = { 'Content-Type': 'application/json' };

  const response = existing
    ? await strapiFetch(token, `/api/system-settings/${existing.documentId}`, {
        method: 'PUT',
        headers,
        body,
      })
    : await strapiFetch(token, `/api/system-settings`, { method: 'POST', headers, body });

  return response.ok;
}
