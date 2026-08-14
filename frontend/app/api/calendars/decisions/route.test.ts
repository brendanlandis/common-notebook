import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The upsert's duplicate handling.
 *
 * Strapi has no compare-and-set, so this handler is read-then-write and two
 * concurrent writes for the same event can each find nothing and each create a
 * row. That is not a tidiness problem: from then on the handler updates one row
 * while `resolveDecisions` reads the other, so the event's state reverts on
 * every refetch and cannot be changed from the UI at all. It happened to a real
 * event within a day of shipping.
 *
 * The client now serializes its writes, which is the actual prevention. This is
 * the repair — the rows already out there heal on the next write, with no
 * migration.
 */

const getAccessToken = vi.fn();
vi.mock('@/app/lib/strapiAuth', () => ({
  getAccessToken: (...a: unknown[]) => getAccessToken(...a),
}));

const strapiFetch = vi.fn();
const fetchAllPages = vi.fn();
vi.mock('@/app/lib/strapiServer', () => ({
  strapiFetch: (...a: unknown[]) => strapiFetch(...a),
  fetchAllPages: (...a: unknown[]) => fetchAllPages(...a),
}));

import { PUT } from './route';

const body = {
  calendar: 'cal-1',
  uid: 'evt@test',
  recurrenceId: null,
  state: 'hide' as const,
};

const request = (payload: unknown = body) => ({ json: async () => payload }) as any;

/** Every path a DELETE was sent to. */
const deleted = () =>
  strapiFetch.mock.calls
    .filter(([, , init]) => init?.method === 'DELETE')
    .map(([, path]) => path as string);

beforeEach(() => {
  vi.clearAllMocks();
  getAccessToken.mockResolvedValue('token');
  strapiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { documentId: 'saved' } }),
  });
});

describe('PUT /api/calendars/decisions', () => {
  it('creates a row when there is none', async () => {
    fetchAllPages.mockResolvedValue([]);

    const response = await PUT(request());

    expect((await response.json()).success).toBe(true);
    expect(strapiFetch).toHaveBeenCalledWith(
      'token',
      '/api/calendar-event-decisions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('updates the existing row rather than adding another', async () => {
    fetchAllPages.mockResolvedValue([{ documentId: 'd-1' }]);

    await PUT(request());

    expect(strapiFetch).toHaveBeenCalledWith(
      'token',
      '/api/calendar-event-decisions/d-1',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(deleted()).toEqual([]);
  });

  it('collapses duplicates onto the row it keeps', async () => {
    // The state that made an event unchangeable: two rows, one updated, the
    // other still winning the resolution.
    fetchAllPages.mockResolvedValue([
      { documentId: 'd-1' },
      { documentId: 'd-2' },
      { documentId: 'd-3' },
    ]);

    await PUT(request());

    expect(deleted()).toEqual([
      '/api/calendar-event-decisions/d-2',
      '/api/calendar-event-decisions/d-3',
    ]);
    expect(strapiFetch).toHaveBeenCalledWith(
      'token',
      '/api/calendar-event-decisions/d-1',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('deletes every row when clearing back to unset', async () => {
    // Unset is the absence of a row at every tier, so a leftover duplicate would
    // mean "cleared" didn't clear.
    fetchAllPages.mockResolvedValue([{ documentId: 'd-1' }, { documentId: 'd-2' }]);

    await PUT(request({ ...body, state: null }));

    expect(deleted()).toEqual([
      '/api/calendar-event-decisions/d-1',
      '/api/calendar-event-decisions/d-2',
    ]);
  });

  it('refuses a state that isn’t show, hide, or null', async () => {
    fetchAllPages.mockResolvedValue([]);

    const response = await PUT(request({ ...body, state: 'maybe' }));

    expect(response.status).toBe(400);
    expect(strapiFetch).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated caller', async () => {
    getAccessToken.mockResolvedValue(null);

    const response = await PUT(request());

    expect(response.status).toBe(401);
    expect(strapiFetch).not.toHaveBeenCalled();
  });
});
