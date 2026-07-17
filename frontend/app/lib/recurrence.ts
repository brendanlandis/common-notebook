import { Temporal } from 'temporal-polyfill';
import * as Astronomy from 'astronomy-engine';
import type { Task } from '../types/index';
import { toISODate, parseDate, getTodayForRecurrence, shiftISODate } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';
import { validateRecurrenceFields } from './recurrenceSpec';

/**
 * Calendar arithmetic has to happen on the user's wall clock, not the machine's.
 *
 * The dates flowing through this file are real instants — `parseDate('2026-01-13',
 * EST)` is 05:00Z — so calendar arithmetic on them must first land on the user's
 * *calendar day*. `toPlainDate` does exactly that: an instant, viewed in the user's
 * zone, as a `Temporal.PlainDate` (year/month/day with no time or zone). Every step
 * below is then plain-date arithmetic — `.add({months: 1})`, `.with({day})` — which
 * is calendar-correct and DST-free by construction, and reads back out as an ISO
 * string with `.toString()`.
 *
 * This replaced a `date-fns` + `date-fns-tz` implementation whose helpers read a
 * Date's *machine-local* components: on a UTC server with an EST user the 2nd Tuesday
 * of February came out a day early, invisibly, because it was correct on a laptop
 * whose zone matched the setting. Astronomy calls (`Seasons`, `SearchMoonPhase`) keep
 * the real instant — a wall-clock value would move the event itself.
 */
function toPlainDate(date: Date, settings: TimeZoneSettings): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(settings.timezone)
    .toPlainDate();
}

/**
 * Convert day of week from our app format (1-7 where 1=Monday, 7=Sunday)
 * to JavaScript's format (0-6 where 0=Sunday, 1=Monday), which the weekday logic
 * below is written in.
 */
function toJSDay(day: number): number {
  return day === 7 ? 0 : day;
}

/** A PlainDate's weekday in JS format (0=Sun..6=Sat); Temporal is 1=Mon..7=Sun. */
function jsDay(d: Temporal.PlainDate): number {
  return d.dayOfWeek === 7 ? 0 : d.dayOfWeek;
}

/**
 * The next date strictly after `from` whose weekday is `targetJSDay`. Matches
 * date-fns `nextDay`: if `from` is already that weekday, the answer is 7 days later.
 */
function nextWeekday(from: Temporal.PlainDate, targetJSDay: number): Temporal.PlainDate {
  let d = from.add({ days: 1 });
  while (jsDay(d) !== targetJSDay) d = d.add({ days: 1 });
  return d;
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
      // When offset > 0: show task before the event.
      // displayDate = the event day minus the offset; dueDate = the event day.
      // eventDate is already a calendar-day string, so plain-date math suffices.
      const displayDate = Temporal.PlainDate.from(eventDate).subtract({ days: offset }).toString();

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

  // Both are real instants, so this picks the later moment correctly. The astronomy
  // branches keep this instant: Seasons and SearchMoonPhase want a true instant, and
  // handing them a shifted one would move the event itself.
  const comparisonDate = existingEventDate && existingEventDate > today
    ? existingEventDate
    : today;

  // The same moment as the user's calendar date, for the calendar arithmetic below.
  const comparison = toPlainDate(comparisonDate, settings);
  const comparisonISO = comparison.toString();
  const comparisonYear = comparison.year;

  switch (task.recurrenceType) {
    case 'monthly date': {
      if (!task.recurrenceDayOfMonth) return null;

      // Set the day of month, capping to the last day when the month is short
      // (e.g. day 31 in February becomes Feb 28/29).
      const setDayOfMonth = (base: Temporal.PlainDate, targetDay: number): Temporal.PlainDate =>
        base.with({ day: Math.min(targetDay, base.daysInMonth) });

      // Start from the comparison day and find the next occurrence
      let targetDate = setDayOfMonth(comparison, task.recurrenceDayOfMonth);

      // Always move to the next month after the comparison day
      if (targetDate.toString() <= comparisonISO) {
        targetDate = setDayOfMonth(comparison.add({ months: 1 }), task.recurrenceDayOfMonth);
      }

      return targetDate.toString();
    }

    case 'monthly day': {
      if (
        task.recurrenceWeekOfMonth === null || task.recurrenceWeekOfMonth === undefined ||
        task.recurrenceDayOfWeekMonthly === null || task.recurrenceDayOfWeekMonthly === undefined
      ) {
        return null;
      }

      const monthlyDayOfWeek = toJSDay(task.recurrenceDayOfWeekMonthly);

      const findNthWeekdayOfMonth = (base: Temporal.PlainDate): Temporal.PlainDate => {
        if (task.recurrenceWeekOfMonth === -1) {
          // Last matching weekday of the month: walk back from the last day.
          let d = base.with({ day: base.daysInMonth });
          while (jsDay(d) !== monthlyDayOfWeek) d = d.subtract({ days: 1 });
          return d;
        }

        const first = base.with({ day: 1 });
        let d = jsDay(first) === monthlyDayOfWeek ? first : nextWeekday(first, monthlyDayOfWeek);

        const weeksToAdd = task.recurrenceWeekOfMonth! - 1;
        if (weeksToAdd > 0) d = d.add({ weeks: weeksToAdd });

        return d;
      };

      // Start from the comparison day and find the next occurrence
      let targetMonthlyDate = findNthWeekdayOfMonth(comparison);

      // Always move to the next month after the comparison day
      if (targetMonthlyDate.toString() <= comparisonISO) {
        targetMonthlyDate = findNthWeekdayOfMonth(comparison.add({ months: 1 }));
      }

      return targetMonthlyDate.toString();
    }

    case 'annually': {
      if (
        task.recurrenceMonth === null || task.recurrenceMonth === undefined ||
        task.recurrenceDayOfMonth === null || task.recurrenceDayOfMonth === undefined
      ) {
        return null;
      }

      // Set month then day, capping the day to the target month's length (e.g. Feb 29
      // in a non-leap year becomes Feb 28).
      const setAnnualDate = (base: Temporal.PlainDate, month: number, day: number): Temporal.PlainDate => {
        const withMonth = base.with({ month });
        return withMonth.with({ day: Math.min(day, withMonth.daysInMonth) });
      };

      // Start from the comparison day and find the next occurrence
      let annualDate = setAnnualDate(comparison, task.recurrenceMonth, task.recurrenceDayOfMonth);

      // Always move to the next year after the comparison day
      if (annualDate.toString() <= comparisonISO) {
        annualDate = setAnnualDate(comparison.add({ years: 1 }), task.recurrenceMonth, task.recurrenceDayOfMonth);
      }

      return annualDate.toString();
    }

    case 'full moon': {
      // Start from midnight of the day *after* comparisonDate, in the user's zone, so
      // a full moon in the target day's 00:00–04:00 window is not skipped past by a
      // whole lunar month (which is what a day added to the 4am boundary instant did).
      // The astronomy call gets a real instant.
      const fullMoonSearchStart = parseDate(shiftISODate(toISODate(comparisonDate, settings), 1), settings);
      const nextFullMoon = Astronomy.SearchMoonPhase(180, fullMoonSearchStart, 40);
      if (!nextFullMoon) return null;
      return toISODate(nextFullMoon.date, settings);
    }

    case 'new moon': {
      const searchStartDate = parseDate(shiftISODate(toISODate(comparisonDate, settings), 1), settings);
      const nextNewMoon = Astronomy.SearchMoonPhase(0, searchStartDate, 40);
      if (!nextNewMoon) return null;
      return toISODate(nextNewMoon.date, settings);
    }

    case 'spring equinox': {
      let springEquinox = Astronomy.Seasons(comparisonYear).mar_equinox;
      if (toISODate(springEquinox.date, settings) <= comparisonISO) {
        springEquinox = Astronomy.Seasons(comparisonYear + 1).mar_equinox;
      }
      return toISODate(springEquinox.date, settings);
    }

    case 'summer solstice': {
      let summerSolstice = Astronomy.Seasons(comparisonYear).jun_solstice;
      if (toISODate(summerSolstice.date, settings) <= comparisonISO) {
        summerSolstice = Astronomy.Seasons(comparisonYear + 1).jun_solstice;
      }
      return toISODate(summerSolstice.date, settings);
    }

    case 'autumn equinox': {
      let autumnEquinox = Astronomy.Seasons(comparisonYear).sep_equinox;
      if (toISODate(autumnEquinox.date, settings) <= comparisonISO) {
        autumnEquinox = Astronomy.Seasons(comparisonYear + 1).sep_equinox;
      }
      return toISODate(autumnEquinox.date, settings);
    }

    case 'winter solstice': {
      let winterSolstice = Astronomy.Seasons(comparisonYear).dec_solstice;
      if (toISODate(winterSolstice.date, settings) <= comparisonISO) {
        winterSolstice = Astronomy.Seasons(comparisonYear + 1).dec_solstice;
      }
      return toISODate(winterSolstice.date, settings);
    }

    case 'every season': {
      const seasons = Astronomy.Seasons(comparisonYear);
      const nextYearSeasons = Astronomy.Seasons(comparisonYear + 1);

      const allSeasons = [
        seasons.mar_equinox.date,
        seasons.jun_solstice.date,
        seasons.sep_equinox.date,
        seasons.dec_solstice.date,
        nextYearSeasons.mar_equinox.date,
      ];

      const nextSeason = allSeasons.find(date => toISODate(date, settings) > comparisonISO);
      return nextSeason ? toISODate(nextSeason, settings) : null;
    }

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
  // getTodayForRecurrence respects the day boundary hour; toPlainDate lands it on the
  // user's calendar day so the weekday and day arithmetic below is in their zone.
  const today = toPlainDate(getTodayForRecurrence(settings), settings);

  switch (task.recurrenceType) {
    case 'daily':
      // Initial creation shows today; after completion, tomorrow.
      return isInitialCreation ? today.toString() : today.add({ days: 1 }).toString();

    case 'every x days':
      if (!task.recurrenceInterval) return null;
      // Initial creation shows today; after completion, X days out.
      return isInitialCreation
        ? today.toString()
        : today.add({ days: task.recurrenceInterval }).toString();

    case 'weekly': {
      if (task.recurrenceDayOfWeek === null || task.recurrenceDayOfWeek === undefined) return null;
      const dayOfWeek = toJSDay(task.recurrenceDayOfWeek);

      // Initial creation, or completed on a different weekday: the next occurrence of
      // the target weekday. Completed on the target weekday: exactly 7 days later.
      if (isInitialCreation) {
        return nextWeekday(today, dayOfWeek).toString();
      }
      return jsDay(today) === dayOfWeek
        ? today.add({ days: 7 }).toString()
        : nextWeekday(today, dayOfWeek).toString();
    }

    case 'biweekly': {
      if (task.recurrenceDayOfWeek === null || task.recurrenceDayOfWeek === undefined) return null;
      const biweeklyDayOfWeek = toJSDay(task.recurrenceDayOfWeek);

      if (isInitialCreation) {
        return nextWeekday(today, biweeklyDayOfWeek).toString();
      }

      // After completion, keep the 14-day cadence anchored on the existing displayDate:
      // step forward 14 days at a time until past today.
      if (!task.displayDate) return null;

      let nextDate = Temporal.PlainDate.from(task.displayDate);
      do {
        nextDate = nextDate.add({ days: 14 });
      } while (Temporal.PlainDate.compare(nextDate, today) <= 0);

      return nextDate.toString();
    }

    default:
      return null;
  }
}
