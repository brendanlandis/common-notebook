/**
 * Recurrence Specification - Source of Truth
 * 
 * This file documents the exact behavior for all 15 recurrence types.
 * All recurrence calculation code should reference this specification.
 */

import type { RecurrenceType, Task } from '../types/index';

/**
 * Calculation modes for different recurrence types
 */
export type CalculationMode = 
  | 'from_completion_date'      // Calculate from actual completion date
  | 'anchored_to_schedule'      // Maintain original schedule anchor
  | 'calendar_based'            // Based on calendar events (month/year)
  | 'astronomical';             // Based on astronomical events

/**
 * Specification for a single recurrence type
 */
export interface RecurrenceTypeSpec {
  type: RecurrenceType;
  calculationMode: CalculationMode;
  shouldDrift: boolean;
  requiredFields: Array<keyof Task>;
  supportsOffset: boolean;
  description: string;
  onInitialCreation: string;
  onCompletion: string;
  examples: string[];
}

/**
 * Complete specification for all recurrence types
 */
export const RECURRENCE_SPECS: Record<RecurrenceType, RecurrenceTypeSpec> = {
  'none': {
    type: 'none',
    calculationMode: 'from_completion_date',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: false,
    description: 'Non-recurring task',
    onInitialCreation: 'N/A - not recurring',
    onCompletion: 'N/A - not recurring',
    examples: ['One-time task'],
  },

  'daily': {
    type: 'daily',
    calculationMode: 'from_completion_date',
    shouldDrift: true,
    requiredFields: [],
    supportsOffset: false,
    description: 'Recurs every day based on completion date',
    onInitialCreation: 'Appears today at next day boundary',
    onCompletion: 'Next occurrence is day after completion (at day boundary)',
    examples: [
      'Complete Jan 10 → next is Jan 11',
      'Complete Jan 15 (deferred from Jan 10) → next is Jan 16',
    ],
  },

  'every x days': {
    type: 'every x days',
    calculationMode: 'from_completion_date',
    shouldDrift: true,
    requiredFields: ['recurrenceInterval'],
    supportsOffset: false,
    description: 'Recurs every X days based on completion date',
    onInitialCreation: 'Appears today at next day boundary',
    onCompletion: 'Next occurrence is X days after completion',
    examples: [
      'Every 3 days: Complete Jan 10 → next is Jan 13',
      'Every 3 days: Complete Jan 15 (deferred) → next is Jan 18',
    ],
  },

  'weekly': {
    type: 'weekly',
    calculationMode: 'from_completion_date',
    shouldDrift: false,
    requiredFields: ['recurrenceDayOfWeek'],
    supportsOffset: false,
    description: 'Recurs on specific weekday, snaps to schedule',
    onInitialCreation: 'Next occurrence of target weekday (not today)',
    onCompletion: 'Next occurrence of target weekday after completion date',
    examples: [
      'Weekly Monday: Create on Wed → appears next Mon',
      'Weekly Monday: Complete on Mon Jan 13 → next is Mon Jan 20',
      'Weekly Monday: Complete on Wed Jan 15 → next is Mon Jan 20',
      'Weekly Monday: Complete on Mon Jan 27 (2 weeks deferred) → next is Mon Feb 3',
    ],
  },

  'biweekly': {
    type: 'biweekly',
    calculationMode: 'anchored_to_schedule',
    shouldDrift: false,
    requiredFields: ['recurrenceDayOfWeek'],
    supportsOffset: false,
    description: 'Recurs every other week on specific weekday, maintains 14-day cycle',
    onInitialCreation: 'Next occurrence of target weekday',
    onCompletion: 'Add 14 days to displayDate anchor until future date found',
    examples: [
      'Biweekly Monday: Create on Wed Jan 8 → appears Mon Jan 13',
      'Biweekly Monday: displayDate Jan 13, complete Jan 13 → next is Jan 27',
      'Biweekly Monday: displayDate Jan 13, complete Jan 20 → next is Jan 27 (maintains schedule)',
      'Biweekly Monday: displayDate Jan 5, complete Feb 2 → next is Feb 16 (Jan 5 + 14 + 14 + 14)',
    ],
  },

  'monthly date': {
    type: 'monthly date',
    calculationMode: 'calendar_based',
    shouldDrift: false,
    requiredFields: ['recurrenceDayOfMonth'],
    supportsOffset: true,
    description: 'Recurs on specific day of month (e.g., 15th)',
    onInitialCreation: 'Next occurrence of target day-of-month',
    onCompletion: 'Next month with same day-of-month after max(completionDate, eventDate)',
    examples: [
      'Monthly 15th: Create Jan 10 → appears Jan 15',
      'Monthly 15th: Complete Jan 15 → next is Feb 15',
      'Monthly 15th: Complete Jan 20 → next is Feb 15',
      'Monthly 15th: Complete Apr 20 (very deferred) → next is May 15',
      'Monthly 31st in February → uses Feb 28/29 (last day of month)',
    ],
  },

  'monthly day': {
    type: 'monthly day',
    calculationMode: 'calendar_based',
    shouldDrift: false,
    requiredFields: ['recurrenceWeekOfMonth', 'recurrenceDayOfWeekMonthly'],
    supportsOffset: true,
    description: 'Recurs on Nth weekday of month (e.g., 2nd Tuesday)',
    onInitialCreation: 'Next occurrence of target weekday-of-month',
    onCompletion: 'Next month\'s occurrence of same weekday-of-month after max(completionDate, eventDate)',
    examples: [
      '2nd Tuesday: Create Jan 11 → appears Jan 13',
      '2nd Tuesday: Complete Jan 13 → next is Feb 10',
      'Last Friday: Complete Jan 31 → next is Feb 27',
    ],
  },

  'annually': {
    type: 'annually',
    calculationMode: 'calendar_based',
    shouldDrift: false,
    requiredFields: ['recurrenceMonth', 'recurrenceDayOfMonth'],
    supportsOffset: true,
    description: 'Recurs on specific month and day every year',
    onInitialCreation: 'Next occurrence of target month/day (current or next year)',
    onCompletion: 'Next year\'s occurrence after max(completionDate, eventDate)',
    examples: [
      'March 15: Create Jan 20, 2026 → appears Mar 15, 2026',
      'March 15: Complete Mar 15, 2026 → next is Mar 15, 2027',
      'Feb 29 in non-leap year → uses Feb 28',
    ],
  },

  'full moon': {
    type: 'full moon',
    calculationMode: 'astronomical',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: true,
    description: 'Recurs on full moon dates',
    onInitialCreation: 'Next full moon date',
    onCompletion: 'Next full moon after max(completionDate, eventDate)',
    examples: [
      'Full moon: Create Jan 20 → next full moon Feb 12',
      'Full moon: eventDate Feb 12, complete Feb 8 → next is Mar 14',
      'Full moon: eventDate Feb 12, complete May 15 → next is Jun 10',
    ],
  },

  'new moon': {
    type: 'new moon',
    calculationMode: 'astronomical',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: true,
    description: 'Recurs on new moon dates',
    onInitialCreation: 'Next new moon date',
    onCompletion: 'Next new moon after max(completionDate, eventDate)',
    examples: [
      'New moon: Same pattern as full moon, but tracking new moons',
    ],
  },

  'every season': {
    type: 'every season',
    calculationMode: 'astronomical',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: true,
    description: 'Recurs on all 4 season changes (equinoxes and solstices)',
    onInitialCreation: 'Next equinox or solstice',
    onCompletion: 'Next equinox/solstice after max(completionDate, eventDate)',
    examples: [
      'Every season: Complete Mar 25 (after Spring Equinox) → next is Summer Solstice Jun 21',
      'Recurs 4 times per year: Spring Equinox, Summer Solstice, Autumn Equinox, Winter Solstice',
    ],
  },

  'winter solstice': {
    type: 'winter solstice',
    calculationMode: 'astronomical',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: true,
    description: 'Recurs annually on winter solstice',
    onInitialCreation: 'Next winter solstice date',
    onCompletion: 'Next winter solstice after max(completionDate, eventDate)',
    examples: [
      'Winter solstice: Around December 21 each year',
    ],
  },

  'spring equinox': {
    type: 'spring equinox',
    calculationMode: 'astronomical',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: true,
    description: 'Recurs annually on spring equinox',
    onInitialCreation: 'Next spring equinox date',
    onCompletion: 'Next spring equinox after max(completionDate, eventDate)',
    examples: [
      'Spring equinox: Around March 20 each year',
    ],
  },

  'summer solstice': {
    type: 'summer solstice',
    calculationMode: 'astronomical',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: true,
    description: 'Recurs annually on summer solstice',
    onInitialCreation: 'Next summer solstice date',
    onCompletion: 'Next summer solstice after max(completionDate, eventDate)',
    examples: [
      'Summer solstice: Around June 21 each year',
    ],
  },

  'autumn equinox': {
    type: 'autumn equinox',
    calculationMode: 'astronomical',
    shouldDrift: false,
    requiredFields: [],
    supportsOffset: true,
    description: 'Recurs annually on autumn equinox',
    onInitialCreation: 'Next autumn equinox date',
    onCompletion: 'Next autumn equinox after max(completionDate, eventDate)',
    examples: [
      'Autumn equinox: Around September 22 each year',
    ],
  },
};

/**
 * Validate that a task has all required fields for its recurrence type
 */
export function validateRecurrenceFields(task: Task): { valid: boolean; errors: string[] } {
  if (!task.isRecurring || task.recurrenceType === 'none') {
    return { valid: true, errors: [] };
  }

  const spec = RECURRENCE_SPECS[task.recurrenceType];
  if (!spec) {
    return { valid: false, errors: [`Unknown recurrence type: ${task.recurrenceType}`] };
  }

  const errors: string[] = [];

  for (const field of spec.requiredFields) {
    const value = task[field];
    if (value === null || value === undefined) {
      errors.push(`Missing required field for ${task.recurrenceType}: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get the specification for a recurrence type
 */
export function getRecurrenceSpec(type: RecurrenceType): RecurrenceTypeSpec {
  return RECURRENCE_SPECS[type];
}

/**
 * Check if a recurrence type supports display date offset
 */
export function supportsDisplayDateOffset(type: RecurrenceType): boolean {
  return RECURRENCE_SPECS[type].supportsOffset;
}

/**
 * Get all recurrence types that support offset
 */
export function getOffsetSupportedTypes(): RecurrenceType[] {
  return Object.values(RECURRENCE_SPECS)
    .filter(spec => spec.supportsOffset)
    .map(spec => spec.type);
}

