import { addDays, addMonths, addYears, nextDay, setDate, setMonth, getDay, startOfMonth, lastDayOfMonth, subDays, addWeeks, isAfter, startOfDay, type Day } from 'date-fns';
import * as Astronomy from 'astronomy-engine';
import type { Todo } from '../types/admin';
import { getNowInEST, getTodayInEST, toISODateInEST, parseInEST } from './dateUtils';

/**
 * Convert day of week from our app format (1-7 where 1=Monday, 7=Sunday)
 * to JavaScript's Date format (0-6 where 0=Sunday, 1=Monday)
 * This is only needed when calling date-fns functions
 */
function toJSDay(day: number): number {
  // 1-6 (Mon-Sat) becomes 1-6
  // 7 (Sunday) becomes 0
  return day === 7 ? 0 : day;
}

/**
 * Determine if a recurrence type has a specific event date
 * These types calculate dates based on calendar or celestial events
 */
function hasEventDate(recurrenceType: string): boolean {
  return [
    "monthly date",
    "monthly day",
    "annually",
    "full moon",
    "new moon",
    "every season",
    "winter solstice",
    "spring equinox",
    "summer solstice",
    "autumn equinox",
  ].includes(recurrenceType);
}

/**
 * Calculate the next recurrence dates for a recurring todo
 * All calculations are based on today's date in EST to ensure recurring tasks
 * always appear in the future, even when completed late.
 * 
 * @param todo - The todo item with recurrence settings
 * @param isInitialCreation - True when creating a new recurring task, false when calculating next occurrence after completion
 * @returns Object with dueDate and displayDate, or null values if not recurring
 */
export function calculateNextRecurrence(todo: Todo, isInitialCreation: boolean = false): { dueDate: string | null; displayDate: string | null } {
  if (!todo.isRecurring) {
    return { dueDate: null, displayDate: null };
  }

  const isEventBased = hasEventDate(todo.recurrenceType);
  
  if (isEventBased) {
    // Calculate the actual event date
    const eventDate = calculateEventDate(todo);
    if (!eventDate) {
      return { dueDate: null, displayDate: null };
    }
    
    const offset = todo.displayDateOffset ?? 0;
    
    if (offset > 0) {
      // When offset > 0: show task before the event
      // displayDate = when to show the task (event - offset)
      // dueDate = the actual event date
      const eventDateObj = parseInEST(eventDate);
      const displayDateObj = subDays(eventDateObj, offset);
      const displayDate = toISODateInEST(displayDateObj);
      
      return { dueDate: eventDate, displayDate };
    } else {
      // When offset is 0 or null: show task on the day of the event
      // displayDate = event date
      // dueDate = null
      return { dueDate: null, displayDate: eventDate };
    }
  } else {
    // Simple recurring tasks (daily, weekly, etc.) - only displayDate needed
    const displayDate = calculateNextDisplayDate(todo, isInitialCreation);
    return { dueDate: null, displayDate };
  }
}

/**
 * Calculate the next event date (for recurrence types with specific event dates)
 * @param todo - The todo item with recurrence settings
 * @returns The next event date as ISO string, or null
 */
function calculateEventDate(todo: Todo): string | null {
  const today = getTodayInEST();
  // For comparison, use the todo's current dueDate if it exists (for tasks with offset),
  // otherwise use displayDate (for tasks without offset), otherwise use today
  // This ensures we always move to the NEXT occurrence when completing a recurring task
  const comparisonDate = todo.dueDate 
    ? parseInEST(todo.dueDate) 
    : todo.displayDate 
    ? parseInEST(todo.displayDate) 
    : today;

  switch (todo.recurrenceType) {
    case 'monthly date':
      if (!todo.recurrenceDayOfMonth) return null;
      
      // Start from comparisonDate and find the next occurrence
      let targetDate = setDate(comparisonDate, todo.recurrenceDayOfMonth);
      
      // Always move to the next month after comparisonDate
      if (!isAfter(targetDate, startOfDay(comparisonDate))) {
        targetDate = setDate(addMonths(comparisonDate, 1), todo.recurrenceDayOfMonth);
      }
      
      return toISODateInEST(targetDate);

    case 'monthly day':
      if (
        todo.recurrenceWeekOfMonth === null || todo.recurrenceWeekOfMonth === undefined ||
        todo.recurrenceDayOfWeekMonthly === null || todo.recurrenceDayOfWeekMonthly === undefined
      ) {
        return null;
      }
      
      const monthlyDayOfWeek = toJSDay(todo.recurrenceDayOfWeekMonthly);
      
      const findNthWeekdayOfMonth = (baseDate: Date): Date => {
        const targetDayOfWeek = monthlyDayOfWeek;
        
        if (todo.recurrenceWeekOfMonth === -1) {
          let targetDate = lastDayOfMonth(baseDate);
          
          while (getDay(targetDate) !== targetDayOfWeek) {
            targetDate = subDays(targetDate, 1);
          }
          
          return targetDate;
        }
        
        const firstDay = startOfMonth(baseDate);
        const currentDayOfWeek = getDay(firstDay);
        
        let targetDate = firstDay;
        if (currentDayOfWeek !== targetDayOfWeek) {
          targetDate = nextDay(firstDay, targetDayOfWeek as Day);
        }
        
        const weeksToAdd = todo.recurrenceWeekOfMonth! - 1;
        if (weeksToAdd > 0) {
          targetDate = addWeeks(targetDate, weeksToAdd);
        }
        
        return targetDate;
      };
      
      // Start from comparisonDate and find the next occurrence
      let targetMonthlyDate = findNthWeekdayOfMonth(comparisonDate);
      
      // Always move to the next month after comparisonDate
      if (!isAfter(targetMonthlyDate, startOfDay(comparisonDate))) {
        targetMonthlyDate = findNthWeekdayOfMonth(addMonths(comparisonDate, 1));
      }
      
      return toISODateInEST(targetMonthlyDate);

    case 'annually':
      if (
        todo.recurrenceMonth === null || todo.recurrenceMonth === undefined ||
        todo.recurrenceDayOfMonth === null || todo.recurrenceDayOfMonth === undefined
      ) {
        return null;
      }
      
      // Start from comparisonDate and find the next occurrence
      let annualDate = setMonth(comparisonDate, todo.recurrenceMonth - 1);
      annualDate = setDate(annualDate, todo.recurrenceDayOfMonth);
      
      // Always move to the next year after comparisonDate
      if (!isAfter(annualDate, startOfDay(comparisonDate))) {
        annualDate = addYears(annualDate, 1);
      }
      
      return toISODateInEST(annualDate);

    case 'full moon':
      // Start search from the day after comparisonDate to ensure we get the NEXT full moon
      const fullMoonSearchStart = addDays(comparisonDate, 1);
      const nextFullMoon = Astronomy.SearchMoonPhase(180, fullMoonSearchStart, 40);
      if (!nextFullMoon) return null;
      return toISODateInEST(nextFullMoon.date);

    case 'new moon':
      // Start search from the day after comparisonDate to ensure we get the NEXT new moon
      const searchStartDate = addDays(comparisonDate, 1);
      const nextNewMoon = Astronomy.SearchMoonPhase(0, searchStartDate, 40);
      if (!nextNewMoon) return null;
      return toISODateInEST(nextNewMoon.date);

    case 'spring equinox':
      const springYear = comparisonDate.getFullYear();
      let springEquinox = Astronomy.Seasons(springYear).mar_equinox;
      // Normalize to start of day for comparison
      if (!isAfter(startOfDay(springEquinox.date), startOfDay(comparisonDate))) {
        springEquinox = Astronomy.Seasons(springYear + 1).mar_equinox;
      }
      return toISODateInEST(springEquinox.date);

    case 'summer solstice':
      const summerYear = comparisonDate.getFullYear();
      let summerSolstice = Astronomy.Seasons(summerYear).jun_solstice;
      // Normalize to start of day for comparison
      if (!isAfter(startOfDay(summerSolstice.date), startOfDay(comparisonDate))) {
        summerSolstice = Astronomy.Seasons(summerYear + 1).jun_solstice;
      }
      return toISODateInEST(summerSolstice.date);

    case 'autumn equinox':
      const autumnYear = comparisonDate.getFullYear();
      let autumnEquinox = Astronomy.Seasons(autumnYear).sep_equinox;
      // Normalize to start of day for comparison
      if (!isAfter(startOfDay(autumnEquinox.date), startOfDay(comparisonDate))) {
        autumnEquinox = Astronomy.Seasons(autumnYear + 1).sep_equinox;
      }
      return toISODateInEST(autumnEquinox.date);

    case 'winter solstice':
      const winterYear = comparisonDate.getFullYear();
      let winterSolstice = Astronomy.Seasons(winterYear).dec_solstice;
      // Normalize to start of day for comparison
      if (!isAfter(startOfDay(winterSolstice.date), startOfDay(comparisonDate))) {
        winterSolstice = Astronomy.Seasons(winterYear + 1).dec_solstice;
      }
      return toISODateInEST(winterSolstice.date);

    case 'every season':
      const seasonYear = comparisonDate.getFullYear();
      const seasons = Astronomy.Seasons(seasonYear);
      const nextYearSeasons = Astronomy.Seasons(seasonYear + 1);
      
      const allSeasons = [
        seasons.mar_equinox.date,
        seasons.jun_solstice.date,
        seasons.sep_equinox.date,
        seasons.dec_solstice.date,
        nextYearSeasons.mar_equinox.date,
      ];
      
      // Normalize to start of day for comparison and find the next season after comparisonDate
      const comparisonDay = startOfDay(comparisonDate);
      const nextSeason = allSeasons.find(date => isAfter(startOfDay(date), comparisonDay));
      return nextSeason ? toISODateInEST(nextSeason) : null;

    default:
      return null;
  }
}

/**
 * Calculate the next display date for a recurring todo (for types with only displayDate)
 * @param todo - The todo item with recurrence settings
 * @param isInitialCreation - True when creating a new recurring task
 * @returns The next display date as ISO string, or null
 */
function calculateNextDisplayDate(todo: Todo, isInitialCreation: boolean = false): string | null {
  // Always calculate from the start of today in EST (midnight)
  // Using getTodayInEST() instead of getNowInEST() ensures consistent day-based calculations
  // regardless of what time of day the calculation runs or the server's timezone
  const today = getTodayInEST();

  switch (todo.recurrenceType) {
    case 'daily':
      if (isInitialCreation) {
        // On initial creation, display today
        return toISODateInEST(today);
      }
      // After completion, next occurrence is tomorrow
      return toISODateInEST(addDays(today, 1));

    case 'every x days':
      if (!todo.recurrenceInterval) return null;
      if (isInitialCreation) {
        // On initial creation, display today
        return toISODateInEST(today);
      }
      // After completion, next occurrence is X days from today
      return toISODateInEST(addDays(today, todo.recurrenceInterval));

    case 'weekly':
      if (todo.recurrenceDayOfWeek === null || todo.recurrenceDayOfWeek === undefined) return null;
      // Convert from our format (1=Mon, 7=Sun) to JS format (0=Sun, 1=Mon)
      const dayOfWeek = toJSDay(todo.recurrenceDayOfWeek);
      
      if (isInitialCreation) {
        // On initial creation, display today
        return toISODateInEST(today);
      }
      // After completion, get next occurrence of the specified day of week after today
      const nextWeekDay = nextDay(today, dayOfWeek as Day);
      return toISODateInEST(nextWeekDay);

    case 'biweekly':
      if (todo.recurrenceDayOfWeek === null || todo.recurrenceDayOfWeek === undefined) return null;
      // Convert from our format (1=Mon, 7=Sun) to JS format (0=Sun, 1=Mon)
      const biweeklyDayOfWeek = toJSDay(todo.recurrenceDayOfWeek);
      
      if (isInitialCreation) {
        // On initial creation, display today
        return toISODateInEST(today);
      }
      // After completion, get next occurrence of the specified day of week, then add 2 weeks
      const nextBiweeklyDay = nextDay(today, biweeklyDayOfWeek as Day);
      return toISODateInEST(addWeeks(nextBiweeklyDay, 2));

    default:
      return null;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use calculateNextRecurrence instead
 */
export function calculateNextDueDate(todo: Todo): string | null {
  const result = calculateNextRecurrence(todo);
  // Return whichever date is set (displayDate for most types, dueDate for event types)
  return result.displayDate || result.dueDate;
}

