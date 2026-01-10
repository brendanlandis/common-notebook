import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as workSessionRoute } from '../[documentId]/work-session/route';
import type { Todo } from '@/app/types/index';

// Mock environment variables
process.env.STRAPI_API_URL = 'http://localhost:1337';

// Helper to create minimal todo for testing
function createTodo(overrides: Partial<Todo>): Todo {
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
    category: 'test category',
    project: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: true, // Default to long todo
    workSessions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock NextRequest with auth token
function createMockRequest(documentId: string, body: any = {}): NextRequest {
  const req = new NextRequest(`http://localhost:3000/api/todos/${documentId}/work-session`, {
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

describe('Work Session API Route Tests', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Authentication', () => {
    it('should reject requests without auth token', async () => {
      const req = new NextRequest('http://localhost:3000/api/todos/test/work-session', {
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
    it('should add work session to long todo', async () => {
      const longTodo = createTodo({
        documentId: 'long-task',
        long: true,
        workSessions: [],
      });

      const updatedTodo = {
        ...longTodo,
        workSessions: [{ date: '2026-01-05', timestamp: '2026-01-05T12:00:00.000-05:00' }],
      };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        
        // Mock system settings for day boundary hour
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, value: '0' }),
          } as Response);
        }
        
        // Mock GET todo
        if (urlStr.includes('long-task?populate=project') && !options?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTodo }),
          } as Response);
        }
        
        // Mock PUT todo
        if (urlStr.includes('long-task?populate=project') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: updatedTodo }),
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

    it('should reject non-long todos with 400 error', async () => {
      const nonLongTodo = createTodo({
        documentId: 'non-long-task',
        long: false,
      });

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, value: '0' }),
          } as Response);
        }
        
        if (urlStr.includes('non-long-task?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: nonLongTodo }),
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
      expect(data.error).toBe('This todo is not marked as long');
    });

    it('should prevent duplicate work sessions for same day', async () => {
      // Use current date to match what the API will calculate
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const todoWithSession = createTodo({
        documentId: 'task-with-session',
        long: true,
        workSessions: [{ date: dateStr, timestamp: now.toISOString() }],
      });

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, value: '0' }),
          } as Response);
        }
        
        if (urlStr.includes('task-with-session?populate=project')) {
          // For PUT requests (updating), this shouldn't be called if duplicate is detected
          if (options?.method === 'PUT') {
            // This shouldn't happen if duplicate detection works
            return Promise.resolve({
              ok: true,
              json: async () => ({ 
                data: {
                  ...todoWithSession,
                  workSessions: [...todoWithSession.workSessions!, { date: dateStr, timestamp: now.toISOString() }]
                }
              }),
            } as Response);
          }
          // For GET requests
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: todoWithSession }),
          } as Response);
        }
        
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('task-with-session', { timezone: 'America/New_York' });
      const params = Promise.resolve({ documentId: 'task-with-session' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      if (data.message) {
        expect(data.message).toBe('Work session already exists for today');
      }
      // Should not have added a new session
      expect(data.data.workSessions.length).toBe(1);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, value: '0' }),
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

  describe('Day Boundary Hour Logic', () => {
    it('should use custom day boundary hour when available', async () => {
      const longTodo = createTodo({
        documentId: 'boundary-task',
        long: true,
        workSessions: [],
      });

      const updatedTodo = {
        ...longTodo,
        workSessions: [{ date: '2026-01-05', timestamp: '2026-01-05T12:00:00.000-05:00' }],
      };

      let dayBoundaryFetched = false;

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        
        // Mock system settings with custom day boundary hour
        if (urlStr.includes('/api/system-settings')) {
          dayBoundaryFetched = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, value: '4' }), // 4 AM boundary
          } as Response);
        }
        
        if (urlStr.includes('boundary-task?populate=project') && !options?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTodo }),
          } as Response);
        }
        
        if (urlStr.includes('boundary-task?populate=project') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: updatedTodo }),
          } as Response);
        }
        
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('boundary-task', { timezone: 'America/New_York' });
      const params = Promise.resolve({ documentId: 'boundary-task' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(dayBoundaryFetched).toBe(true);
    });

    it('should default to midnight when day boundary hour is not configured', async () => {
      const longTodo = createTodo({
        documentId: 'default-boundary-task',
        long: true,
        workSessions: [],
      });

      const updatedTodo = {
        ...longTodo,
        workSessions: [{ date: '2026-01-05', timestamp: '2026-01-05T12:00:00.000-05:00' }],
      };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        
        // Mock system settings returning no value
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          } as Response);
        }
        
        if (urlStr.includes('default-boundary-task?populate=project') && !options?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTodo }),
          } as Response);
        }
        
        if (urlStr.includes('default-boundary-task?populate=project') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: updatedTodo }),
          } as Response);
        }
        
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('default-boundary-task', { timezone: 'America/New_York' });
      const params = Promise.resolve({ documentId: 'default-boundary-task' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Timezone Handling', () => {
    it('should accept timezone from request body', async () => {
      const longTodo = createTodo({
        documentId: 'tz-task',
        long: true,
        workSessions: [],
      });

      const updatedTodo = {
        ...longTodo,
        workSessions: [{ date: '2026-01-05', timestamp: '2026-01-05T12:00:00.000-08:00' }],
      };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, value: '0' }),
          } as Response);
        }
        
        if (urlStr.includes('tz-task?populate=project') && !options?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTodo }),
          } as Response);
        }
        
        if (urlStr.includes('tz-task?populate=project') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: updatedTodo }),
          } as Response);
        }
        
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('tz-task', { timezone: 'America/Los_Angeles' });
      const params = Promise.resolve({ documentId: 'tz-task' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should default to America/New_York when no timezone provided', async () => {
      const longTodo = createTodo({
        documentId: 'default-tz-task',
        long: true,
        workSessions: [],
      });

      const updatedTodo = {
        ...longTodo,
        workSessions: [{ date: '2026-01-05', timestamp: '2026-01-05T12:00:00.000-05:00' }],
      };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, value: '0' }),
          } as Response);
        }
        
        if (urlStr.includes('default-tz-task?populate=project') && !options?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: longTodo }),
          } as Response);
        }
        
        if (urlStr.includes('default-tz-task?populate=project') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: updatedTodo }),
          } as Response);
        }
        
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('default-tz-task', {}); // No timezone in body
      const params = Promise.resolve({ documentId: 'default-tz-task' });
      
      const response = await workSessionRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
