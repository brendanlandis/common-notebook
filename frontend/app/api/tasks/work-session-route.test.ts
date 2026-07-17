import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as workSessionRoute } from './[documentId]/work-session/route';
import type { Task } from '@/app/types/index';

// Mock environment variables
process.env.STRAPI_API_URL = 'http://localhost:1337';

// Helper to create minimal task for testing
function createTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    documentId: 'test-doc-id',
    title: 'Test long task',
    description: [],
    completed: false,
    completedAt: null,
    dueDate: null,
    displayDate: null,
    displayDateOffset: null,
    isRecurring: false,
    recurrenceType: 'none',
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    project: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: true, // Default to long task
    workSessions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock NextRequest with auth token
function createMockRequest(documentId: string, body: any = {}): NextRequest {
  const req = new NextRequest(`http://localhost:3000/api/tasks/${documentId}/work-session`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  // Mock cookies
  Object.defineProperty(req, 'cookies', {
    value: {
      get: vi.fn((name: string) => {
        if (name === 'auth_token') {
          return { value: 'mock-auth-token' };
        }
        return undefined;
      }),
    },
  });
  
  // Mock nextUrl for system settings fetch
  Object.defineProperty(req, 'nextUrl', {
    value: {
      origin: 'http://localhost:3000',
    },
  });
  
  // Mock headers
  Object.defineProperty(req, 'headers', {
    value: {
      get: vi.fn((name: string) => {
        if (name === 'cookie') {
          return 'auth_token=mock-auth-token';
        }
        return null;
      }),
    },
  });
  
  return req;
}

type SettingsConfig = { timezone?: string | null; dayBoundaryHour?: string | null };

/** What production actually defaults to — see `app/lib/defaultSettings.ts`. */
const DEFAULT_TEST_SETTINGS: SettingsConfig = {
  timezone: 'America/New_York',
  dayBoundaryHour: '4',
};

/**
 * Strapi's response to `getSystemSetting`'s title-filtered lookup.
 *
 * Every mock in this file used to answer `{ success: true, value: '0' }` — the shape
 * this app's *own* `/api/*` routes return, not Strapi's. `getSystemSetting` reads
 * `body.data?.[0]`, so it saw undefined and every test silently ran on the fallback
 * defaults instead of the settings it was declaring. That is why the mock has to be
 * per-title too: `getTimeZoneSettings` fetches timezone and dayBoundaryHour
 * separately, and one blanket answer makes both settings the same value.
 *
 * A `null` here models a row that does not exist, which is the normal state for a
 * new account and the case the readers' fallbacks exist for.
 */
function settingsResponse(urlStr: string, settings: SettingsConfig) {
  const title = urlStr.includes('dayBoundaryHour') ? 'dayBoundaryHour' : 'timezone';
  const value = settings[title];
  if (value == null) return { data: [] };
  return { data: [{ documentId: `setting-${title}`, title, value, date: null }] };
}

/** The `workSessions` array the route actually wrote to Strapi. */
function writtenSessions(fetchMock: any) {
  const put = fetchMock.mock.calls.find((c: any[]) => c[1]?.method === 'PUT');
  return put ? JSON.parse(put[1].body).data.workSessions : null;
}

describe('Work Session API Route Tests', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe('Authentication', () => {
    it('should reject requests without auth token', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks/test/work-session', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      // Mock cookies without auth token
      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn(() => undefined),
        },
      });

      const params = Promise.resolve({ documentId: 'test' });
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Adding Work Sessions', () => {
    it('should add work session to long task', async () => {
      const longTask = createTask({
        documentId: 'long-task',
        long: true,
        workSessions: [],
      });

      const updatedTask = {
        ...longTask,
        workSessions: [{ date: '2026-01-05', timestamp: '2026-01-05T12:00:00.000-05:00' }],
      };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        
        // Mock system settings for day boundary hour
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => settingsResponse(urlStr, DEFAULT_TEST_SETTINGS),
          } as Response);
        }

        // Mock GET task
        if (urlStr.includes('long-task?populate=project') && !options?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTask }),
          } as Response);
        }
        
        // Mock PUT task
        if (urlStr.includes('long-task?populate=project') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: updatedTask }),
          } as Response);
        }
        
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('long-task', { timezone: 'America/New_York' });
      const params = Promise.resolve({ documentId: 'long-task' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.workSessions).toBeDefined();
      expect(data.data.workSessions.length).toBeGreaterThan(0);
    });

    it('should reject non-long tasks with 400 error', async () => {
      const nonLongTask = createTask({
        documentId: 'non-long-task',
        long: false,
      });

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => settingsResponse(urlStr, DEFAULT_TEST_SETTINGS),
          } as Response);
        }

        if (urlStr.includes('non-long-task?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: nonLongTask }),
          } as Response);
        }
        
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('non-long-task', { timezone: 'America/New_York' });
      const params = Promise.resolve({ documentId: 'non-long-task' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This task is not marked as long');
    });

    /**
     * These pin the clock, because the effective day depends on the day boundary
     * hour and this test used to depend on when it ran.
     *
     * It mocked `/api/system-settings` with `{ success: true, value: '0' }` — the
     * *frontend* envelope, not Strapi's. `getSystemSetting` reads `body.data?.[0]`,
     * so it saw undefined and fell back to the defaults (America/New_York, boundary
     * 4am) rather than the boundary 0 the author meant to configure. The old expected
     * date was the plain calendar day in New York, with no boundary logic: under
     * boundary 0 that matches, but under boundary 4 it only matches between 4am and
     * midnight. So the suite failed for the four hours after midnight and passed the
     * rest of the day.
     *
     * So: mock settings in Strapi's real shape, and pin the instant.
     */
    const runDuplicateCase = async (nowISO: string, sessionDate: string) => {
      // shouldAdvanceTime keeps the awaited fetch mocks from stalling on a frozen clock.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(nowISO));

      const taskWithSession = createTask({
        documentId: 'task-with-session',
        long: true,
        workSessions: [{ date: sessionDate, timestamp: nowISO }],
      });

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();

        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => settingsResponse(urlStr, DEFAULT_TEST_SETTINGS),
          } as Response);
        }

        if (urlStr.includes('task-with-session?populate=project')) {
          if (options?.method === 'PUT') {
            // Reached only if duplicate detection failed. Echo the body back rather
            // than re-spreading the task's own array: the route pushes onto that same
            // array, so the old mock reported 3 sessions for a single stray write and
            // obscured what had actually gone wrong.
            const body = JSON.parse(options.body);
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: { ...taskWithSession, ...body.data } }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: taskWithSession }),
          } as Response);
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('task-with-session');
      const params = Promise.resolve({ documentId: 'task-with-session' });

      const response = await workSessionRoute(req, { params });
      return { response, data: await response.json() };
    };

    it('should prevent duplicate work sessions for same day', async () => {
      // 10:00 in New York — comfortably after the 4am boundary, so the effective
      // day is the calendar day.
      const { response, data } = await runDuplicateCase('2026-01-05T15:00:00.000Z', '2026-01-05');

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Work session already exists for today');
      expect(data.data.workSessions.length).toBe(1);
    });

    /**
     * The case the old test could never express: 01:00 in New York is before the 4am
     * boundary, so the session belongs to the *previous* day. Pinning the clock here
     * is what lets this be asserted at all — it is the window the suite used to fail in.
     */
    it('treats a pre-boundary session as the previous day, in any system zone', async () => {
      const { data } = await runDuplicateCase('2026-01-05T06:00:00.000Z', '2026-01-04');

      expect(data.message).toBe('Work session already exists for today');
      expect(data.data.workSessions.length).toBe(1);
      expect(data.data.workSessions[0].date).toBe('2026-01-04');
    });

    it('adds a session for the new effective day once the boundary has passed', async () => {
      // Same instant as above, but the stored session is the day before that — so
      // 2026-01-04 is genuinely today and no duplicate exists for it.
      const { data } = await runDuplicateCase('2026-01-05T06:00:00.000Z', '2026-01-03');

      expect(data.data.workSessions.length).toBe(2);
      expect(data.data.workSessions[1].date).toBe('2026-01-04');
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => settingsResponse(urlStr, DEFAULT_TEST_SETTINGS),
          } as Response);
        }

        // Simulate API error
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        } as Response);
      });

      const req = createMockRequest('error-task', { timezone: 'America/New_York' });
      const params = Promise.resolve({ documentId: 'error-task' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  /**
   * Each of these asserts the *date the route wrote*, and pins an instant where the
   * configured setting and the fallback disagree about which day it is. That is the
   * only way the assertion can fail if the setting is ignored: the previous versions
   * checked `status === 200` and a "was it fetched?" flag, which the route passes
   * whatever it decides the day is.
   */
  describe('Day Boundary Hour Logic', () => {
    const runBoundaryCase = async (nowISO: string, settings: SettingsConfig) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(nowISO));

      const longTask = createTask({
        documentId: 'boundary-task',
        long: true,
        workSessions: [],
      });

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();

        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => settingsResponse(urlStr, settings),
          } as Response);
        }

        if (urlStr.includes('boundary-task?populate=project')) {
          if (options?.method === 'PUT') {
            const body = JSON.parse(options.body);
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: { ...longTask, ...body.data } }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTask }),
          } as Response);
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('boundary-task');
      const params = Promise.resolve({ documentId: 'boundary-task' });
      const response = await workSessionRoute(req, { params });

      return { response, sessions: writtenSessions(global.fetch) };
    };

    it('uses the configured day boundary hour rather than the default', async () => {
      // 05:00 in New York. Under the configured 6am boundary the day has not started,
      // so this belongs to the 4th; under the default 4am it would be the 5th. The
      // old test configured '4' — the same as the default — so it could not tell the
      // two apart even once its mock was fixed.
      const { response, sessions } = await runBoundaryCase('2026-01-05T10:00:00.000Z', {
        timezone: 'America/New_York',
        dayBoundaryHour: '6',
      });

      expect(response.status).toBe(200);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].date).toBe('2026-01-04');
    });

    it('falls back to the default 4am boundary when the row is missing', async () => {
      // 02:00 in New York, with no dayBoundaryHour row — the normal state for a new
      // account. The default is 4am (defaultSettings.ts), so this is still the 4th.
      // This test used to be called "should default to midnight", which the defaults
      // table has not agreed with; at midnight the answer would be the 5th.
      const { sessions } = await runBoundaryCase('2026-01-05T07:00:00.000Z', {
        timezone: 'America/New_York',
        dayBoundaryHour: null,
      });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].date).toBe('2026-01-04');
    });
  });

  /**
   * These were called "should accept timezone from request body" and "should default
   * to America/New_York when no timezone provided". The route stopped reading the
   * body's timezone when it gained the ability to resolve one from the caller's
   * token, so the first was asserting a contract that no longer exists — and since
   * both only checked `status === 200`, neither noticed.
   */
  describe('Timezone Handling', () => {
    const runTimezoneCase = async (settings: SettingsConfig, body: any = {}) => {
      // 03:00 in Los Angeles, 06:00 in New York. With a 4am boundary the two zones
      // disagree about the day — LA is still on the 5th, New York has reached the
      // 6th — so the assertion can only pass if the route used the right zone.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-01-06T11:00:00.000Z'));

      const longTask = createTask({
        documentId: 'tz-task',
        long: true,
        workSessions: [],
      });

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();

        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => settingsResponse(urlStr, settings),
          } as Response);
        }

        if (urlStr.includes('tz-task?populate=project')) {
          if (options?.method === 'PUT') {
            const put = JSON.parse(options.body);
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: { ...longTask, ...put.data } }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTask }),
          } as Response);
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('tz-task', body);
      const params = Promise.resolve({ documentId: 'tz-task' });
      const response = await workSessionRoute(req, { params });

      return { response, sessions: writtenSessions(global.fetch) };
    };

    it("uses the timezone from the caller's settings, not the request body", async () => {
      const { response, sessions } = await runTimezoneCase(
        { timezone: 'America/Los_Angeles', dayBoundaryHour: '4' },
        // Ignored. A client that posts this cannot move another user's day.
        { timezone: 'America/New_York' }
      );

      expect(response.status).toBe(200);
      expect(sessions[0].date).toBe('2026-01-05');
    });

    it('falls back to America/New_York when the timezone row is missing', async () => {
      const { sessions } = await runTimezoneCase({ timezone: null, dayBoundaryHour: '4' });

      expect(sessions[0].date).toBe('2026-01-06');
    });
  });
});
