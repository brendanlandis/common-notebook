import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as skipRoute } from '../[documentId]/skip/route';
import { POST as completeRoute } from '../[documentId]/complete/route';
import type { Todo } from '@/app/types/index';
import * as dateUtils from '@/app/lib/dateUtils';

// Mock environment variables
process.env.STRAPI_API_URL = 'http://localhost:1337';

// Mock date utilities for consistent test dates
vi.mock('@/app/lib/dateUtils', async () => {
  const actual = await vi.importActual('@/app/lib/dateUtils');
  return {
    ...actual,
    getTodayForRecurrence: vi.fn(),
    getTodayInEST: vi.fn(),
    getNowInEST: vi.fn(),
    parseInEST: (dateString: string) => new Date(dateString + 'T00:00:00'),
    toISODateInEST: (date: Date) => date.toISOString().split('T')[0],
    getISOTimestampInEST: vi.fn(() => '2026-01-05T12:00:00.000Z'),
  };
});

// Mock timezone config
vi.mock('@/app/lib/timezoneConfig', () => ({
  getTimezone: vi.fn(() => 'America/New_York'),
  setCachedTimezone: vi.fn(),
  fetchTimezoneFromStrapi: vi.fn(),
  saveTimezoneToStrapi: vi.fn(),
}));

// Helper to create minimal todo for testing
function createTodo(overrides: Partial<Todo>): Todo {
  return {
    id: 1,
    documentId: 'test-doc-id',
    title: 'Test recurring task',
    description: [],
    completed: false,
    completedAt: null,
    dueDate: null,
    displayDate: '2026-01-05',
    displayDateOffset: null,
    isRecurring: true,
    recurrenceType: 'daily',
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
    long: false,
    workSessions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock NextRequest with auth token
function createMockRequest(documentId: string): NextRequest {
  const req = new NextRequest(`http://localhost:3000/api/todos/${documentId}/skip`, {
    method: 'POST',
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
  
  return req;
}

describe('Recurring Todo Routes - Skip vs Complete', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Set a fixed "today" for all tests - Monday, Jan 5, 2026
    vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
    vi.mocked(dateUtils.getTodayInEST).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
    vi.mocked(dateUtils.getNowInEST).mockReturnValue(
      new Date('2026-01-05T12:00:00')
    );
    
    // Save original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('Skip Route', () => {
    it('should reject non-recurring todos with 400 error', async () => {
      const nonRecurringTodo = createTodo({
        documentId: 'non-recurring',
        isRecurring: false,
        recurrenceType: 'none',
      });

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('non-recurring?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: nonRecurringTodo }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('non-recurring');
      const params = Promise.resolve({ documentId: 'non-recurring' });
      
      const response = await skipRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Todo is not recurring');
    });

    it('should delete current todo and create new instance for daily recurrence', async () => {
      const dailyTodo = createTodo({
        documentId: 'daily-task',
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const newTodoResponse = { ...dailyTodo, documentId: 'daily-task-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-task?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: dailyTodo }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/todos?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({ data: newTodoResponse }),
          } as Response);
        }
        if (method === 'DELETE' && urlStr.includes('daily-task')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('daily-task');
      const params = Promise.resolve({ documentId: 'daily-task' });
      
      const response = await skipRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newTodo.displayDate).toBe('2026-01-06'); // Tomorrow
      expect(data.deletedTodo.documentId).toBe('daily-task');
    });

    it('should require authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/todos/test/skip', {
        method: 'POST',
      });
      
      // Mock cookies without auth token
      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn(() => undefined),
        },
      });

      const params = Promise.resolve({ documentId: 'test' });
      
      const response = await skipRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Complete Route', () => {
    it('should mark todo as complete and create new instance for recurring todos', async () => {
      const dailyTodo = createTodo({
        documentId: 'daily-complete',
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const completedTodo = { ...dailyTodo, completed: true, completedAt: '2026-01-05T12:00:00.000Z' };
      const newTodoResponse = { ...dailyTodo, documentId: 'daily-complete-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: dailyTodo }),
          } as Response);
        }
        if (method === 'PUT' && urlStr.includes('daily-complete')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: completedTodo }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/todos?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({ data: newTodoResponse }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('daily-complete');
      const params = Promise.resolve({ documentId: 'daily-complete' });
      
      const response = await completeRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newTodo.displayDate).toBe('2026-01-06');
      
      // Verify no DELETE was called (key difference from skip)
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('daily-complete'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should mark non-recurring todo as complete without creating new instance', async () => {
      const nonRecurringTodo = createTodo({
        documentId: 'non-recurring-complete',
        isRecurring: false,
        recurrenceType: 'none',
      });

      const completedTodo = { ...nonRecurringTodo, completed: true, completedAt: '2026-01-05T12:00:00.000Z' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('non-recurring-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: nonRecurringTodo }),
          } as Response);
        }
        if (method === 'PUT') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: completedTodo }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const req = createMockRequest('non-recurring-complete');
      const params = Promise.resolve({ documentId: 'non-recurring-complete' });
      
      const response = await completeRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newTodo).toBe(null); // No new todo created
    });

    it('should require authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/todos/test/complete', {
        method: 'POST',
      });
      
      // Mock cookies without auth token
      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn(() => undefined),
        },
      });

      const params = Promise.resolve({ documentId: 'test' });
      
      const response = await completeRoute(req, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Behavioral Parity - Skip vs Complete', () => {
    it('should produce identical next dates for daily recurrence', async () => {
      const dailyTodo = createTodo({
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      // Test skip
      const skipTodo = { ...dailyTodo, documentId: 'daily-skip' };
      const skipNewTodo = { ...skipTodo, documentId: 'daily-skip-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-skip?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipTodo }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/todos?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipNewTodo }),
          } as Response);
        }
        if (method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const skipReq = createMockRequest('daily-skip');
      const skipParams = Promise.resolve({ documentId: 'daily-skip' });
      const skipResponse = await skipRoute(skipReq, { params: skipParams });
      const skipData = await skipResponse.json();

      // Test complete
      const completeTodo = { ...dailyTodo, documentId: 'daily-complete' };
      const completeNewTodo = { ...completeTodo, documentId: 'daily-complete-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeTodo }),
          } as Response);
        }
        if (method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { ...completeTodo, completed: true } }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/todos?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeNewTodo }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const completeReq = createMockRequest('daily-complete');
      const completeParams = Promise.resolve({ documentId: 'daily-complete' });
      const completeResponse = await completeRoute(completeReq, { params: completeParams });
      const completeData = await completeResponse.json();

      // Verify identical next dates
      expect(skipData.newTodo.displayDate).toBe(completeData.newTodo.displayDate);
      expect(skipData.newTodo.dueDate).toBe(completeData.newTodo.dueDate);
      expect(skipData.newTodo.displayDate).toBe('2026-01-06');
    });

    it('should produce identical next dates for weekly recurrence', async () => {
      const weeklyTodo = createTodo({
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05', // Monday
      });

      // Test skip
      const skipTodo = { ...weeklyTodo, documentId: 'weekly-skip' };
      const skipNewTodo = { ...skipTodo, documentId: 'weekly-skip-new', displayDate: '2026-01-12' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('weekly-skip?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipTodo }),
          } as Response);
        }
        if (method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipNewTodo }),
          } as Response);
        }
        if (method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const skipReq = createMockRequest('weekly-skip');
      const skipParams = Promise.resolve({ documentId: 'weekly-skip' });
      const skipResponse = await skipRoute(skipReq, { params: skipParams });
      const skipData = await skipResponse.json();

      // Test complete
      const completeTodo = { ...weeklyTodo, documentId: 'weekly-complete' };
      const completeNewTodo = { ...completeTodo, documentId: 'weekly-complete-new', displayDate: '2026-01-12' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('weekly-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeTodo }),
          } as Response);
        }
        if (method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { ...completeTodo, completed: true } }),
          } as Response);
        }
        if (method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeNewTodo }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response);
      });

      const completeReq = createMockRequest('weekly-complete');
      const completeParams = Promise.resolve({ documentId: 'weekly-complete' });
      const completeResponse = await completeRoute(completeReq, { params: completeParams });
      const completeData = await completeResponse.json();

      // Verify identical next dates
      expect(skipData.newTodo.displayDate).toBe(completeData.newTodo.displayDate);
      expect(skipData.newTodo.displayDate).toBe('2026-01-12'); // Next Monday
    });
  });
});
