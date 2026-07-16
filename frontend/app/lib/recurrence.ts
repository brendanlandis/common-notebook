import { addDays, addMonths, addYears, nextDay, setDate, setMonth, getDay, startOfMonth, lastDayOfMonth, subDays, addWeeks, type Day } from 'date-fns';
import * as Astronomy from 'astronomy-engine';
import type { Task } from '../types/index';
import { toISODate, parseDate, getTodayForRecurrence } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';
import { validateRecurrenceFields } from './recurrenceSpec';

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
 * Calculate the next recurrence dates for a recurring task
 * All calculations respect the day boundary hour setting for determining "today"
 * and use appropriate calculation modes based on recurrence type.
 * 
 * @param task - The task item with recurrence settings
 * @param settings - The owner's timezone and day boundary hour
 * @param isInitialCreation - True when creating a new recurring task, false when calculating next occurrence after completion
 * @returns Object with dueDate and displayDate, or null values if not recurring
 */
export function calculateNextRecurrence(
  task: Task,
  settings: TimeZoneSettings,
  isInitialCreation: boolean = false
): { dueDate: string | null; displayDate: string | null } {
  if (!task.isRecurring) {
    return { dueDate: null, displayDate: null };
  }

  // Validate that task has required fields for its recurrence type
  const validation = validateRecurrenceFields(task);
  if (!validation.valid) {
    // Silently return null - validation should be enforced at the form level
    return { dueDate: null, displayDate: null };
  }

  const isEventBased = hasEventDate(task.recurrenceType);
  
  if (isEventBased) {
    // Calculate the actual event date
    const eventDate = calculateEventDate(task, settings);
    if (!eventDate) {
      return { dueDate: null, displayDate: null };
    }

    const offset = task.displayDateOffset ?? 0;

    if (offset > 0) {
      // When offset > 0: show task before the event
      // displayDate = when to show the task (event - offset)
      // dueDate = the actual event date
      const eventDateObj = parseDate(eventDate, settings);
      const displayDateObj = subDays(eventDateObj, offset);
      const displayDate = toISODate(displayDateObj, settings);

      return { dueDate: eventDate, displayDate };
    } else {
      // When offset is 0 or null: show task on the day of the event
      // displayDate = event date
      // dueDate = null
      return { dueDate: null, displayDate: eventDate };
    }
  } else {
    // Simple recurring tasks (daily, weekly, etc.) - only displayDate needed
    const displayDate = calculateNextDisplayDate(task, settings, isInitialCreation);
    return { dueDate: null, displayDate };
  }
}

/**
 * Calculate the next event date (for recurrence types with specific event dates)
 * Uses max(completionDate, eventDate) to prevent duplicate occurrences
 * 
 * @param task - The task item with recurrence settings
 * @param settings - The owner's timezone and day boundary hour
 * @returns The next event date as ISO string, or null
 */
function calculateEventDate(task: Task, settings: TimeZoneSettings): string | null {
  const today = getTodayForRecurrence(settings);
  
  // Reference date is the later of: completion date or existing event date
  // This prevents creating duplicate events when completing before the event date
  const existingEventDate = task.dueDate 
    ? parseDate(task.dueDate, settings) 
    : task.displayDate 
    ? parseDate(task.displayDate, settings) 
    : null;
  
  const comparisonDate = existingEventDate && existingEventDate > today
    ? existingEventDate
    : today;

  switch (task.recurrenceType) {
    case 'monthly date':
      if (!task.recurrenceDayOfMonth) return null;
      
      // Helper to set day of month, using last day if target doesn't exist
      const setDayOfMonth = (baseDate: Date, targetDay: number): Date => {
        const lastDay = lastDayOfMonth(baseDate);
        const lastDayNum = lastDay.getDate();
        
        if (targetDay > lastDayNum) {
          // Month doesn't have this day (e.g., Feb 31), use last day
          return lastDay;
        }
        return setDate(baseDate, targetDay);
      };
      
      // Start from comparisonDate and find the next occurrence
      let targetDate = setDayOfMonth(comparisonDate, task.recurrenceDayOfMonth);
      
      // Always move to the next month after comparisonDate
      // Compare ISO date strings in configured timezone instead of using startOfDay()
      // which uses system timezone and causes issues on UTC servers
      if (toISODate(targetDate, settings) <= toISODate(comparisonDate, settings)) {
        const monthAdded = addMonths(comparisonDate, 1);
        targetDate = setDayOfMonth(monthAdded, task.recurrenceDayOfMonth);
      }
      
      return toISODate(targetDate, settings);

    case 'monthly day':
      if (
        task.recurrenceWeekOfMonth === null || task.recurrenceWeekOfMonth === undefined ||
        task.recurrenceDayOfWeekMonthly === null || task.recurrenceDayOfWeekMonthly === undefined
      ) {
        return null;
      }
      
      const monthlyDayOfWeek = toJSDay(task.recurrenceDayOfWeekMonthly);
      
      const findNthWeekdayOfMonth = (baseDate: Date): Date => {
        const targetDayOfWeek = monthlyDayOfWeek;
        
        if (task.recurrenceWeekOfMonth === -1) {
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
        
        const weeksToAdd = task.recurrenceWeekOfMonth! - 1;
        if (weeksToAdd > 0) {
          targetDate = addWeeks(targetDate, weeksToAdd);
        }
        
        return targetDate;
      };
      
      // Start from comparisonDate and find the next occurrence
      let targetMonthlyDate = findNthWeekdayOfMonth(comparisonDate);
      
      // Always move to the next month after comparisonDate
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(targetMonthlyDate, settings) <= toISODate(comparisonDate, settings)) {
        targetMonthlyDate = findNthWeekdayOfMonth(addMonths(comparisonDate, 1));
      }
      
      return toISODate(targetMonthlyDate, settings);

    case 'annually':
      if (
        task.recurrenceMonth === null || task.recurrenceMonth === undefined ||
        task.recurrenceDayOfMonth === null || task.recurrenceDayOfMonth === undefined
      ) {
        return null;
      }
      
      // Helper to set annual date, using last day if target doesn't exist (e.g., Feb 29 in non-leap year)
      const setAnnualDate = (baseDate: Date, month: number, day: number): Date => {
        const withMonth = setMonth(baseDate, month - 1);
        const lastDay = lastDayOfMonth(withMonth);
        const lastDayNum = lastDay.getDate();
        
        if (day > lastDayNum) {
          // Day doesn't exist in this month/year, use last day
          return lastDay;
        }
        return setDate(withMonth, day);
      };
      
      // Start from comparisonDate and find the next occurrence
      let annualDate = setAnnualDate(comparisonDate, task.recurrenceMonth, task.recurrenceDayOfMonth);
      
      // Always move to the next year after comparisonDate
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(annualDate, settings) <= toISODate(comparisonDate, settings)) {
        const nextYear = addYears(comparisonDate, 1);
        annualDate = setAnnualDate(nextYear, task.recurrenceMonth, task.recurrenceDayOfMonth);
      }
      
      return toISODate(annualDate, settings);

    case 'full moon':
      // Start search from the day after comparisonDate to ensure we get the NEXT full moon
      const fullMoonSearchStart = addDays(comparisonDate, 1);
      const nextFullMoon = Astronomy.SearchMoonPhase(180, fullMoonSearchStart, 40);
      if (!nextFullMoon) return null;
      return toISODate(nextFullMoon.date, settings);

    case 'new moon':
      // Start search from the day after comparisonDate to ensure we get the NEXT new moon
      const searchStartDate = addDays(comparisonDate, 1);
      const nextNewMoon = Astronomy.SearchMoonPhase(0, searchStartDate, 40);
      if (!nextNewMoon) return null;
      return toISODate(nextNewMoon.date, settings);

    case 'spring equinox':
      const springYear = comparisonDate.getFullYear();
      let springEquinox = Astronomy.Seasons(springYear).mar_equinox;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(springEquinox.date, settings) <= toISODate(comparisonDate, settings)) {
        springEquinox = Astronomy.Seasons(springYear + 1).mar_equinox;
      }
      return toISODate(springEquinox.date, settings);

    case 'summer solstice':
      const summerYear = comparisonDate.getFullYear();
      let summerSolstice = Astronomy.Seasons(summerYear).jun_solstice;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(summerSolstice.date, settings) <= toISODate(comparisonDate, settings)) {
        summerSolstice = Astronomy.Seasons(summerYear + 1).jun_solstice;
      }
      return toISODate(summerSolstice.date, settings);

    case 'autumn equinox':
      const autumnYear = comparisonDate.getFullYear();
      let autumnEquinox = Astronomy.Seasons(autumnYear).sep_equinox;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(autumnEquinox.date, settings) <= toISODate(comparisonDate, settings)) {
        autumnEquinox = Astronomy.Seasons(autumnYear + 1).sep_equinox;
      }
      return toISODate(autumnEquinox.date, settings);

    case 'winter solstice':
      const winterYear = comparisonDate.getFullYear();
      let winterSolstice = Astronomy.Seasons(winterYear).dec_solstice;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(winterSolstice.date, settings) <= toISODate(comparisonDate, settings)) {
        winterSolstice = Astronomy.Seasons(winterYear + 1).dec_solstice;
      }
      return toISODate(winterSolstice.date, settings);

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
      
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      const comparisonDayISO = toISODate(comparisonDate, settings);
      const nextSeason = allSeasons.find(date => toISODate(date, settings) > comparisonDayISO);
      return nextSeason ? toISODate(nextSeason, settings) : null;

    default:
      return null;
  }
}

/**
 * Calculate the next display date for a recurring task (for types with only displayDate)
 * Respects day boundary hour for determining "today"
 * 
 * @param task - The task item with recurrence settings
 * @param settings - The owner's timezone and day boundary hour
 * @param isInitialCreation - True when creating a new recurring task
 * @returns The next display date as ISO string, or null
 */
function calculateNextDisplayDate(
  task: Task,
  settings: TimeZoneSettings,
  isInitialCreation: boolean = false
): string | null {
  // Use getTodayForRecurrence(settings) which respects day boundary hour
  const today = getTodayForRecurrence(settings);

  switch (task.recurrenceType) {
    case 'daily':
      if (isInitialCreation) {
        // On initial creation, display today
        return toISODate(today, settings);
      }
      // After completion, next occurrence is tomorrow
      return toISODate(addDays(today, 1), settings);

    case 'every x days':
      if (!task.recurrenceInterval) return null;
      if (isInitialCreation) {
        // On initial creation, display today
        return toISODate(today, settings);
      }
      // After completion, next occurrence is X days from today
      return toISODate(addDays(today, task.recurrenceInterval), settings);

    case 'weekly':
      if (task.recurrenceDayOfWeek === null || task.recurrenceDayOfWeek === undefined) return null;
      // Convert from our format (1=Mon, 7=Sun) to JS format (0=Sun, 1=Mon)
      const dayOfWeek = toJSDay(task.recurrenceDayOfWeek);
      
      if (isInitialCreation) {
        // On initial creation, find next occurrence of target weekday (not today)
        const nextWeekDay = nextDay(today, dayOfWeek as Day);
        return toISODate(nextWeekDay, settings);
      }
      
      // After completion, find next occurrence of target weekday
      const completionDay = getDay(today);
      
      if (completionDay === dayOfWeek) {
        // Completed on the correct day, next occurrence is 7 days later
        return toISODate(addDays(today, 7), settings);
      } else {
        // Completed on different day, find next occurrence of target day
        const nextWeekDay = nextDay(today, dayOfWeek as Day);
        return toISODate(nextWeekDay, settings);
      }

    case 'biweekly':
      if (task.recurrenceDayOfWeek === null || task.recurrenceDayOfWeek === undefined) return null;
      // Convert from our format (1=Mon, 7=Sun) to JS format (0=Sun, 1=Mon)
      const biweeklyDayOfWeek = toJSDay(task.recurrenceDayOfWeek);
      
      if (isInitialCreation) {
        // On initial creation, find next occurrence of target weekday
        const nextBiweeklyDay = nextDay(today, biweeklyDayOfWeek as Day);
        return toISODate(nextBiweeklyDay, settings);
      }
      
      // After completion, maintain 14-day cycle from displayDate anchor
      // Add 14 days repeatedly until we get a future date
      if (!task.displayDate) return null;
      
      let nextDate = parseDate(task.displayDate, settings);
      do {
        nextDate = addDays(nextDate, 14);
      } while (nextDate <= today);
      
      return toISODate(nextDate, settings);

    default:
      return null;
  }
}

