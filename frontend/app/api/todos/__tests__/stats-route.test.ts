import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../stats/route';
import { NextRequest } from 'next/server';
import * as dateUtils from '@/app/lib/dateUtils';

// Mock date utilities
vi.mock('@/app/lib/dateUtils', () => ({
  getTodayForRecurrence: vi.fn(),
  toISODateInEST: vi.fn(),
}));

// Helper to create mock request
function createMockRequest(url: string, cookies: Record<string, string> = {}): NextRequest {
  const request = new NextRequest(new URL(url, 'http://localhost'));
  
  // Mock cookies
  vi.spyOn(request.cookies, 'get').mockImplementation((name: string) => {
    return cookies[name] ? { value: cookies[name], name } as any : undefined;
  });

  return request;
}

// Mock fetch setup
function setupMockFetch(responses: Record<string, any>) {
  global.fetch = vi.fn((url: string) => {
    const urlString = url.toString();
    
    // Find matching response
    for (const [key, value] of Object.entries(responses)) {
      if (urlString.includes(key)) {
        return Promise.resolve({
          ok: true,
          json: async () => value,
        } as Response);
      }
    }
    
    // Default response
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }),
    } as Response);
  }) as any;
}

describe('Stats API Route - Work Session Counting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default date mocks
    const today = new Date('2026-01-10T00:00:00.000Z');
    vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(today);
    vi.mocked(dateUtils.toISODateInEST).mockImplementation((date: Date) => {
      return date.toISOString().split('T')[0];
    });
  });

  describe('Work Session Counting', () => {
    it('should count work sessions from long todos', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              title: 'Long Task',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
                { date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
              ],
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      
      // Should have counted 2 work sessions for "My Project"
      const projectStat = data.data.find((s: any) => s.name === 'My Project');
      expect(projectStat).toBeDefined();
      expect(projectStat.count).toBe(2);
      expect(projectStat.type).toBe('project');
    });

    it('should count work sessions for category todos', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              title: 'Long Category Task',
              long: true,
              isRecurring: false,
              category: 'home',
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
              ],
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      
      // Categories are summed into "chores"
      const choresStat = data.data.find((s: any) => s.name === 'chores');
      expect(choresStat).toBeDefined();
      expect(choresStat.count).toBe(1);
    });

    it('should only count work sessions within date range', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' }, // Within range
                { date: '2026-01-01', timestamp: '2026-01-01T10:00:00.000Z' }, // Outside 7-day range
              ],
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      const projectStat = data.data.find((s: any) => s.name === 'My Project');
      expect(projectStat).toBeDefined();
      expect(projectStat.count).toBe(1); // Only the recent session
    });

    it('should combine work sessions with completed todos for same project', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [
            {
              documentId: 'completed-1',
              completed: true,
              completedAt: '2026-01-09T15:00:00.000Z',
              isRecurring: false,
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
              ],
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      const projectStat = data.data.find((s: any) => s.name === 'My Project');
      expect(projectStat).toBeDefined();
      expect(projectStat.count).toBe(2); // 1 completed + 1 work session
    });

    it('should count multiple work sessions for same project', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
                { date: '2026-01-09', timestamp: '2026-01-09T14:00:00.000Z' },
                { date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
              ],
              project: {
                documentId: 'proj-1',
                title: 'Big Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      const projectStat = data.data.find((s: any) => s.name === 'Big Project');
      expect(projectStat).toBeDefined();
      expect(projectStat.count).toBe(3);
    });

    it('should count work sessions for day job projects', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
                { date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
              ],
              project: {
                documentId: 'work-proj',
                title: 'Work Project',
                world: 'day job',
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      const dayJobStat = data.data.find((s: any) => s.name === 'day job');
      expect(dayJobStat).toBeDefined();
      expect(dayJobStat.count).toBe(2);
      expect(dayJobStat.type).toBe('project');
    });

    it('should count work sessions for work chores category', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              category: 'work chores',
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
              ],
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      const dayJobStat = data.data.find((s: any) => s.name === 'day job');
      expect(dayJobStat).toBeDefined();
      expect(dayJobStat.count).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle long todos with no work sessions', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [],
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual([]); // No stats since no completed or worked-on tasks
    });

    it('should handle long todos with null work sessions', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: null,
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });

    it('should skip recurring long todos with work sessions', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'recurring-long',
              long: true,
              isRecurring: true,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
              ],
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual([]); // Should skip recurring tasks
    });

    it('should not count work sessions for incidental todos', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
              ],
              // No project or category - incidental
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual([]); // Incidentals are not counted
    });

    it('should not count work sessions in excluded categories', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              category: 'in the mail',
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
              ],
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual([]); // "in the mail" is excluded
    });
  });

  describe('Multiple Long Todos', () => {
    it('should aggregate work sessions across multiple long todos', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' },
              ],
              project: {
                documentId: 'proj-1',
                title: 'Project A',
                world: null,
              },
            },
            {
              documentId: 'long-2',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
              ],
              project: {
                documentId: 'proj-1',
                title: 'Project A',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      const projectStat = data.data.find((s: any) => s.name === 'Project A');
      expect(projectStat).toBeDefined();
      expect(projectStat.count).toBe(2); // 1 session from each long todo
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      setupMockFetch({});

      const request = createMockRequest('http://localhost/api/todos/stats?days=7', {});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Date Range Parameter', () => {
    it('should respect custom days parameter', async () => {
      setupMockFetch({
        'filters[completed][$eq]=true': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'filters[long][$eq]=true': {
          data: [
            {
              documentId: 'long-1',
              long: true,
              isRecurring: false,
              workSessions: [
                { date: '2026-01-09', timestamp: '2026-01-09T10:00:00.000Z' }, // 1 day ago
                { date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' }, // 2 days ago
                { date: '2026-01-07', timestamp: '2026-01-07T10:00:00.000Z' }, // 3 days ago
              ],
              project: {
                documentId: 'proj-1',
                title: 'My Project',
                world: null,
              },
            },
          ],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
        'practice-logs': {
          data: [],
          meta: { pagination: { page: 1, pageCount: 1 } },
        },
      });

      const request = createMockRequest('http://localhost/api/todos/stats?days=2', {
        auth_token: 'test-token',
      });

      const response = await GET(request);
      const data = await response.json();

      const projectStat = data.data.find((s: any) => s.name === 'My Project');
      expect(projectStat).toBeDefined();
      // With days=2, should only include sessions from 2026-01-08 onwards (2026-01-08 to 2026-01-10)
      // 2026-01-09 and 2026-01-08 are within range, but 2026-01-07 is outside (3 days ago)
      expect(projectStat.count).toBe(2);
    });
  });
});
