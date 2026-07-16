import { addDays, addMonths, addYears, nextDay, setDate, setMonth, getDay, startOfMonth, lastDayOfMonth, subDays, addWeeks, type Day } from 'date-fns';
import * as Astronomy from 'astronomy-engine';
import type { Task } from '../types/index';
import { toISODate, parseDate, getTodayForRecurrence, toZonedTime } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';
import { validateRecurrenceFields } from './recurrenceSpec';

/**
 * Calendar arithmetic has to happen on the user's wall clock, not the machine's.
 *
 * Every date-fns function here (setDate, startOfMonth, nextDay, addWeeks, getDay,
 * addDays…) reads and writes a Date's *local* components. The dates flowing through
 * this file are real instants — `parseDate('2026-01-13', EST)` is 05:00Z — so doing
 * that arithmetic on them directly runs it in whatever calendar the machine happens
 * to be in. On a UTC server with an EST user, the 2nd Tuesday of February was
 * computed as 2026-02-10T00:00Z, which *is* Feb 9 in New York: every monthly and
 * annual recurrence landed a day early. It looked correct on a laptop whose zone
 * matched the setting, which is why it survived.
 *
 * `toZonedTime` puts the user's wall clock into the local components, so date-fns
 * then operates in their calendar. `zonedYMD` reads it back out — it must not go
 * through toISODate, which would convert a second time. The comparison fix at the
 * old call sites ("compare ISO strings, not startOfDay") was half of this: it
 * corrected how the results were compared but not how they were computed.
 */
function toWallClock(date: Date, settings: TimeZoneSettings): Date {
  return toZonedTime(date, settings.timezone);
}

function zonedYMD(wallClock: Date): string {
  const year = wallClock.getFullYear();
  const month = String(wallClock.getMonth() + 1).padStart(2, '0');
  const day = String(wallClock.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
      const eventWallClock = toWallClock(parseDate(eventDate, settings), settings);
      const displayDate = zonedYMD(subDays(eventWallClock, offset));

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
  
  // Both are real instants, so this picks the later moment correctly.
  const comparisonDate = existingEventDate && existingEventDate > today
    ? existingEventDate
    : today;

  // The same moment on the user's wall clock, for the calendar arithmetic below.
  // The astronomy branches deliberately keep `comparisonDate`: Astronomy.Seasons and
  // SearchMoonPhase want a true instant, and handing them a shifted one would move
  // the event itself.
  const comparisonWallClock = toWallClock(comparisonDate, settings);
  const comparisonISO = zonedYMD(comparisonWallClock);
  const comparisonYear = comparisonWallClock.getFullYear();

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
      
      // Start from the comparison day and find the next occurrence
      let targetDate = setDayOfMonth(comparisonWallClock, task.recurrenceDayOfMonth);

      // Always move to the next month after the comparison day
      if (zonedYMD(targetDate) <= comparisonISO) {
        const monthAdded = addMonths(comparisonWallClock, 1);
        targetDate = setDayOfMonth(monthAdded, task.recurrenceDayOfMonth);
      }

      return zonedYMD(targetDate);

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
      
      // Start from the comparison day and find the next occurrence
      let targetMonthlyDate = findNthWeekdayOfMonth(comparisonWallClock);

      // Always move to the next month after the comparison day
      if (zonedYMD(targetMonthlyDate) <= comparisonISO) {
        targetMonthlyDate = findNthWeekdayOfMonth(addMonths(comparisonWallClock, 1));
      }

      return zonedYMD(targetMonthlyDate);

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
      
      // Start from the comparison day and find the next occurrence
      let annualDate = setAnnualDate(comparisonWallClock, task.recurrenceMonth, task.recurrenceDayOfMonth);

      // Always move to the next year after the comparison day
      if (zonedYMD(annualDate) <= comparisonISO) {
        const nextYear = addYears(comparisonWallClock, 1);
        annualDate = setAnnualDate(nextYear, task.recurrenceMonth, task.recurrenceDayOfMonth);
      }

      return zonedYMD(annualDate);

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
      const springYear = comparisonYear;
      let springEquinox = Astronomy.Seasons(springYear).mar_equinox;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(springEquinox.date, settings) <= comparisonISO) {
        springEquinox = Astronomy.Seasons(springYear + 1).mar_equinox;
      }
      return toISODate(springEquinox.date, settings);

    case 'summer solstice':
      const summerYear = comparisonYear;
      let summerSolstice = Astronomy.Seasons(summerYear).jun_solstice;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(summerSolstice.date, settings) <= comparisonISO) {
        summerSolstice = Astronomy.Seasons(summerYear + 1).jun_solstice;
      }
      return toISODate(summerSolstice.date, settings);

    case 'autumn equinox':
      const autumnYear = comparisonYear;
      let autumnEquinox = Astronomy.Seasons(autumnYear).sep_equinox;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(autumnEquinox.date, settings) <= comparisonISO) {
        autumnEquinox = Astronomy.Seasons(autumnYear + 1).sep_equinox;
      }
      return toISODate(autumnEquinox.date, settings);

    case 'winter solstice':
      const winterYear = comparisonYear;
      let winterSolstice = Astronomy.Seasons(winterYear).dec_solstice;
      // Compare ISO date strings in configured timezone (startOfDay uses system timezone)
      if (toISODate(winterSolstice.date, settings) <= comparisonISO) {
        winterSolstice = Astronomy.Seasons(winterYear + 1).dec_solstice;
      }
      return toISODate(winterSolstice.date, settings);

    case 'every season':
      const seasonYear = comparisonYear;
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
      const nextSeason = allSeasons.find(date => toISODate(date, settings) > comparisonISO);
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
  // Use getTodayForRecurrence(settings) which respects day boundary hour, then move
  // onto the user's wall clock for the same reason the event paths above do: every
  // date-fns call here works on local components. These cases happen to survive an
  // instant (a 4am EST boundary is 09:00Z, still mid-day in most zones, so getDay
  // reads the same weekday) — but that is luck, not design, and it is one settings
  // change away from being wrong.
  const today = toWallClock(getTodayForRecurrence(settings), settings);

  switch (task.recurrenceType) {
    case 'daily':
      if (isInitialCreation) {
        // On initial creation, display today
        return zonedYMD(today);
      }
      // After completion, next occurrence is tomorrow
      return zonedYMD(addDays(today, 1));

    case 'every x days':
      if (!task.recurrenceInterval) return null;
      if (isInitialCreation) {
        // On initial creation, display today
        return zonedYMD(today);
      }
      // After completion, next occurrence is X days from today
      return zonedYMD(addDays(today, task.recurrenceInterval));

    case 'weekly':
      if (task.recurrenceDayOfWeek === null || task.recurrenceDayOfWeek === undefined) return null;
      // Convert from our format (1=Mon, 7=Sun) to JS format (0=Sun, 1=Mon)
      const dayOfWeek = toJSDay(task.recurrenceDayOfWeek);
      
      if (isInitialCreation) {
        // On initial creation, find next occurrence of target weekday (not today)
        const nextWeekDay = nextDay(today, dayOfWeek as Day);
        return zonedYMD(nextWeekDay);
      }
      
      // After completion, find next occurrence of target weekday
      const completionDay = getDay(today);
      
      if (completionDay === dayOfWeek) {
        // Completed on the correct day, next occurrence is 7 days later
        return zonedYMD(addDays(today, 7));
      } else {
        // Completed on different day, find next occurrence of target day
        const nextWeekDay = nextDay(today, dayOfWeek as Day);
        return zonedYMD(nextWeekDay);
      }

    case 'biweekly':
      if (task.recurrenceDayOfWeek === null || task.recurrenceDayOfWeek === undefined) return null;
      // Convert from our format (1=Mon, 7=Sun) to JS format (0=Sun, 1=Mon)
      const biweeklyDayOfWeek = toJSDay(task.recurrenceDayOfWeek);
      
      if (isInitialCreation) {
        // On initial creation, find next occurrence of target weekday
        const nextBiweeklyDay = nextDay(today, biweeklyDayOfWeek as Day);
        return zonedYMD(nextBiweeklyDay);
      }
      
      // After completion, maintain 14-day cycle from displayDate anchor
      // Add 14 days repeatedly until we get a future date
      if (!task.displayDate) return null;
      
      let nextDate = toWallClock(parseDate(task.displayDate, settings), settings);
      do {
        nextDate = addDays(nextDate, 14);
      } while (nextDate <= today);
      
      return zonedYMD(nextDate);

    default:
      return null;
  }
}

