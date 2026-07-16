import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as skipRoute } from './[documentId]/skip/route';
import { POST as completeRoute } from './[documentId]/complete/route';
import type { Task } from '@/app/types/index';
import * as dateUtils from '@/app/lib/dateUtils';

// Mock environment variables
process.env.STRAPI_API_URL = 'http://localhost:1337';

// Mock date utilities for consistent test dates
vi.mock('@/app/lib/dateUtils', async () => {
  const actual = await vi.importActual('@/app/lib/dateUtils');
  return {
    ...actual,
    getTodayForRecurrence: vi.fn(),
    getToday: vi.fn(),
    getNow: vi.fn(),
    parseDate: (dateString: string) => new Date(dateString + 'T00:00:00'),
    toISODate: (date: Date) => date.toISOString().split('T')[0],
    getISOTimestamp: vi.fn(() => '2026-01-05T12:00:00.000Z'),
  };
});


// Helper to create minimal task for testing
function createTask(overrides: Partial<Task>): Task {
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
  const req = new NextRequest(`http://localhost:3000/api/tasks/${documentId}/skip`, {
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

describe('Recurring Task Routes - Skip vs Complete', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Set a fixed "today" for all tests - Monday, Jan 5, 2026
    vi.mocked(dateUtils.getTodayForRecurrence).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
    vi.mocked(dateUtils.getToday).mockReturnValue(
      new Date('2026-01-05T00:00:00')
    );
    vi.mocked(dateUtils.getNow).mockReturnValue(
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
    it('should reject non-recurring tasks with 400 error', async () => {
      const nonRecurringTask = createTask({
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
            json: async () => ({ data: nonRecurringTask }),
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
      expect(data.error).toBe('Task is not recurring');
    });

    it('should delete current task and create new instance for daily recurrence', async () => {
      const dailyTask = createTask({
        documentId: 'daily-task',
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const newTaskResponse = { ...dailyTask, documentId: 'daily-task-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-task?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: dailyTask }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/tasks?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({ data: newTaskResponse }),
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
      expect(data.newTask.displayDate).toBe('2026-01-06'); // Tomorrow
      expect(data.deletedTask.documentId).toBe('daily-task');
    });

    it('should require authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks/test/skip', {
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
    it('should mark task as complete and create new instance for recurring tasks', async () => {
      const dailyTask = createTask({
        documentId: 'daily-complete',
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      const completedTask = { ...dailyTask, completed: true, completedAt: '2026-01-05T12:00:00.000Z' };
      const newTaskResponse = { ...dailyTask, documentId: 'daily-complete-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: dailyTask }),
          } as Response);
        }
        if (method === 'PUT' && urlStr.includes('daily-complete')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: completedTask }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/tasks?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({ data: newTaskResponse }),
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
      expect(data.newTask.displayDate).toBe('2026-01-06');
      
      // Verify no DELETE was called (key difference from skip)
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('daily-complete'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should mark non-recurring task as complete without creating new instance', async () => {
      const nonRecurringTask = createTask({
        documentId: 'non-recurring-complete',
        isRecurring: false,
        recurrenceType: 'none',
      });

      const completedTask = { ...nonRecurringTask, completed: true, completedAt: '2026-01-05T12:00:00.000Z' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('non-recurring-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: nonRecurringTask }),
          } as Response);
        }
        if (method === 'PUT') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: completedTask }),
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
      expect(data.newTask).toBe(null); // No new task created
    });

    it('should require authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks/test/complete', {
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
      const dailyTask = createTask({
        recurrenceType: 'daily',
        displayDate: '2026-01-05',
      });

      // Test skip
      const skipTask = { ...dailyTask, documentId: 'daily-skip' };
      const skipNewTask = { ...skipTask, documentId: 'daily-skip-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-skip?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipTask }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/tasks?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipNewTask }),
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
      const completeTask = { ...dailyTask, documentId: 'daily-complete' };
      const completeNewTask = { ...completeTask, documentId: 'daily-complete-new', displayDate: '2026-01-06' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('daily-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeTask }),
          } as Response);
        }
        if (method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { ...completeTask, completed: true } }),
          } as Response);
        }
        if (method === 'POST' && urlStr.includes('/api/tasks?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeNewTask }),
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
      expect(skipData.newTask.displayDate).toBe(completeData.newTask.displayDate);
      expect(skipData.newTask.dueDate).toBe(completeData.newTask.dueDate);
      expect(skipData.newTask.displayDate).toBe('2026-01-06');
    });

    it('should produce identical next dates for weekly recurrence', async () => {
      const weeklyTask = createTask({
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1, // Monday
        displayDate: '2026-01-05', // Monday
      });

      // Test skip
      const skipTask = { ...weeklyTask, documentId: 'weekly-skip' };
      const skipNewTask = { ...skipTask, documentId: 'weekly-skip-new', displayDate: '2026-01-12' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('weekly-skip?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipTask }),
          } as Response);
        }
        if (method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: skipNewTask }),
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
      const completeTask = { ...weeklyTask, documentId: 'weekly-complete' };
      const completeNewTask = { ...completeTask, documentId: 'weekly-complete-new', displayDate: '2026-01-12' };

      global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        
        if (urlStr.includes('weekly-complete?populate=project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeTask }),
          } as Response);
        }
        if (method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { ...completeTask, completed: true } }),
          } as Response);
        }
        if (method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: completeNewTask }),
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
      expect(skipData.newTask.displayDate).toBe(completeData.newTask.displayDate);
      expect(skipData.newTask.displayDate).toBe('2026-01-12'); // Next Monday
    });
  });
});
