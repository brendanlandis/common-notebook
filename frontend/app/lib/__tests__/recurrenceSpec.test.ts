import { describe, it, expect } from 'vitest';
import { 
  validateRecurrenceFields, 
  getRecurrenceSpec,
  supportsDisplayDateOffset,
  getOffsetSupportedTypes,
  RECURRENCE_SPECS
} from '../recurrenceSpec';
import type { Todo } from '@/app/types/admin';

// Helper to create minimal todo for testing
function createTodo(overrides: Partial<Todo>): Todo {
  return {
    id: 1,
    documentId: 'test-1',
    title: 'Test task',
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
    category: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    createdAt: '',
    updatedAt: '',
    publishedAt: '',
    ...overrides,
  };
}

describe('Recurrence Specification', () => {
  describe('validateRecurrenceFields', () => {
    it('should pass validation for non-recurring task', () => {
      const todo = createTodo({ isRecurring: false, recurrenceType: 'none' });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for valid daily task (no required fields)', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'daily' 
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for valid weekly task with recurrenceDayOfWeek', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: 1
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for weekly task without recurrenceDayOfWeek', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'weekly',
        recurrenceDayOfWeek: null
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field for weekly: recurrenceDayOfWeek');
    });

    it('should pass validation for valid "every x days" with recurrenceInterval', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'every x days',
        recurrenceInterval: 3
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for "every x days" without recurrenceInterval', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'every x days',
        recurrenceInterval: null
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field for every x days: recurrenceInterval');
    });

    it('should pass validation for valid monthly date with recurrenceDayOfMonth', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: 15
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for monthly date without recurrenceDayOfMonth', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'monthly date',
        recurrenceDayOfMonth: null
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field for monthly date: recurrenceDayOfMonth');
    });

    it('should pass validation for valid monthly day with both required fields', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: 2,
        recurrenceDayOfWeekMonthly: 3
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for monthly day missing recurrenceWeekOfMonth', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'monthly day',
        recurrenceWeekOfMonth: null,
        recurrenceDayOfWeekMonthly: 3
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field for monthly day: recurrenceWeekOfMonth');
    });

    it('should pass validation for valid annually with month and day', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'annually',
        recurrenceMonth: 3,
        recurrenceDayOfMonth: 15
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for annually missing recurrenceMonth', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'annually',
        recurrenceMonth: null,
        recurrenceDayOfMonth: 15
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field for annually: recurrenceMonth');
    });

    it('should pass validation for biweekly with required field', () => {
      const todo = createTodo({ 
        isRecurring: true, 
        recurrenceType: 'biweekly',
        recurrenceDayOfWeek: 1
      });
      const result = validateRecurrenceFields(todo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for astronomical types (no required fields)', () => {
      const types = ['full moon', 'new moon', 'spring equinox', 'summer solstice', 
                     'autumn equinox', 'winter solstice', 'every season'];
      
      types.forEach(type => {
        const todo = createTodo({ 
          isRecurring: true, 
          recurrenceType: type as any
        });
        const result = validateRecurrenceFields(todo);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('getRecurrenceSpec', () => {
    it('should return correct spec for daily', () => {
      const spec = getRecurrenceSpec('daily');
      expect(spec.type).toBe('daily');
      expect(spec.calculationMode).toBe('from_completion_date');
      expect(spec.shouldDrift).toBe(true);
      expect(spec.requiredFields).toHaveLength(0);
    });

    it('should return correct spec for weekly', () => {
      const spec = getRecurrenceSpec('weekly');
      expect(spec.type).toBe('weekly');
      expect(spec.calculationMode).toBe('from_completion_date');
      expect(spec.shouldDrift).toBe(false);
      expect(spec.requiredFields).toContain('recurrenceDayOfWeek');
    });

    it('should return correct spec for biweekly', () => {
      const spec = getRecurrenceSpec('biweekly');
      expect(spec.type).toBe('biweekly');
      expect(spec.calculationMode).toBe('anchored_to_schedule');
      expect(spec.shouldDrift).toBe(false);
      expect(spec.requiredFields).toContain('recurrenceDayOfWeek');
    });

    it('should return correct spec for monthly date', () => {
      const spec = getRecurrenceSpec('monthly date');
      expect(spec.type).toBe('monthly date');
      expect(spec.calculationMode).toBe('calendar_based');
      expect(spec.shouldDrift).toBe(false);
      expect(spec.supportsOffset).toBe(true);
    });

    it('should return correct spec for full moon', () => {
      const spec = getRecurrenceSpec('full moon');
      expect(spec.type).toBe('full moon');
      expect(spec.calculationMode).toBe('astronomical');
      expect(spec.shouldDrift).toBe(false);
      expect(spec.supportsOffset).toBe(true);
    });

    it('should have specs for all 15 recurrence types', () => {
      const types = Object.keys(RECURRENCE_SPECS);
      expect(types).toHaveLength(15);
      expect(types).toContain('none');
      expect(types).toContain('daily');
      expect(types).toContain('weekly');
      expect(types).toContain('biweekly');
      expect(types).toContain('monthly date');
      expect(types).toContain('monthly day');
      expect(types).toContain('annually');
      expect(types).toContain('full moon');
      expect(types).toContain('new moon');
      expect(types).toContain('every season');
      expect(types).toContain('spring equinox');
      expect(types).toContain('summer solstice');
      expect(types).toContain('autumn equinox');
      expect(types).toContain('winter solstice');
      expect(types).toContain('every x days');
    });
  });

  describe('supportsDisplayDateOffset', () => {
    it('should return false for daily/weekly/biweekly', () => {
      expect(supportsDisplayDateOffset('daily')).toBe(false);
      expect(supportsDisplayDateOffset('weekly')).toBe(false);
      expect(supportsDisplayDateOffset('biweekly')).toBe(false);
      expect(supportsDisplayDateOffset('every x days')).toBe(false);
    });

    it('should return true for monthly date/day/annually', () => {
      expect(supportsDisplayDateOffset('monthly date')).toBe(true);
      expect(supportsDisplayDateOffset('monthly day')).toBe(true);
      expect(supportsDisplayDateOffset('annually')).toBe(true);
    });

    it('should return true for all astronomical types', () => {
      expect(supportsDisplayDateOffset('full moon')).toBe(true);
      expect(supportsDisplayDateOffset('new moon')).toBe(true);
      expect(supportsDisplayDateOffset('spring equinox')).toBe(true);
      expect(supportsDisplayDateOffset('summer solstice')).toBe(true);
      expect(supportsDisplayDateOffset('autumn equinox')).toBe(true);
      expect(supportsDisplayDateOffset('winter solstice')).toBe(true);
      expect(supportsDisplayDateOffset('every season')).toBe(true);
    });

    it('should return false for none type', () => {
      expect(supportsDisplayDateOffset('none')).toBe(false);
    });
  });

  describe('getOffsetSupportedTypes', () => {
    it('should return all types that support offset', () => {
      const types = getOffsetSupportedTypes();
      
      // Should include calendar-based types
      expect(types).toContain('monthly date');
      expect(types).toContain('monthly day');
      expect(types).toContain('annually');
      
      // Should include astronomical types
      expect(types).toContain('full moon');
      expect(types).toContain('new moon');
      expect(types).toContain('every season');
      expect(types).toContain('spring equinox');
      expect(types).toContain('summer solstice');
      expect(types).toContain('autumn equinox');
      expect(types).toContain('winter solstice');
      
      // Should NOT include simple recurring types
      expect(types).not.toContain('daily');
      expect(types).not.toContain('weekly');
      expect(types).not.toContain('biweekly');
      expect(types).not.toContain('every x days');
      expect(types).not.toContain('none');
    });
  });
});

