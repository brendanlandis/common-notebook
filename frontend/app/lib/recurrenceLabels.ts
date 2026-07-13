import type { Task } from "@/app/types/index";

/**
 * Converts a day index (0-6) to a lowercase day name
 * @param dayIndex - 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export function getDayName(dayIndex: number | null | undefined): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  if (dayIndex == null || dayIndex < 0 || dayIndex > 6) {
    return "unknown";
  }
  return days[dayIndex];
}

/**
 * Converts a number to its ordinal form (1st, 2nd, 3rd, etc.)
 * @param num - The number to convert
 */
export function getOrdinal(num: number): string {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) {
    return num + "st";
  }
  if (j === 2 && k !== 12) {
    return num + "nd";
  }
  if (j === 3 && k !== 13) {
    return num + "rd";
  }
  return num + "th";
}

/**
 * Converts a month index (1-12) to a lowercase month name
 * @param monthIndex - 1 = January, 2 = February, ..., 12 = December
 */
export function getMonthName(monthIndex: number | null | undefined): string {
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  if (monthIndex == null || monthIndex < 1 || monthIndex > 12) {
    return "unknown";
  }
  return months[monthIndex - 1];
}

/**
 * Generates a recurrence prefix for a task item based on its recurrence type
 * @param task - The task item
 * @returns A human-readable recurrence prefix (e.g., "every day", "every 2 days", "every sunday")
 */
export function getRecurrencePrefix(task: Task): string {
  switch (task.recurrenceType) {
    case "daily":
      return "every day";
    
    case "every x days":
      if (task.recurrenceInterval != null && task.recurrenceInterval > 0) {
        return `every ${task.recurrenceInterval} days`;
      }
      return "every x days";
    
    case "weekly":
      // Database uses ISO 8601 standard (1=Mon, 2=Tue, ..., 7=Sun), convert to getDayName format (0=Sun, 1=Mon, ..., 6=Sat)
      if (task.recurrenceDayOfWeek != null && task.recurrenceDayOfWeek >= 1 && task.recurrenceDayOfWeek <= 7) {
        return `every ${getDayName(task.recurrenceDayOfWeek % 7)}`;
      }
      return "weekly";
    
    case "biweekly":
      // Database uses ISO 8601 standard (1=Mon, 2=Tue, ..., 7=Sun), convert to getDayName format (0=Sun, 1=Mon, ..., 6=Sat)
      if (task.recurrenceDayOfWeek != null && task.recurrenceDayOfWeek >= 1 && task.recurrenceDayOfWeek <= 7) {
        return `every other ${getDayName(task.recurrenceDayOfWeek % 7)}`;
      }
      return "biweekly";
    
    case "monthly date":
      if (task.recurrenceDayOfMonth != null && task.recurrenceDayOfMonth >= 1 && task.recurrenceDayOfMonth <= 31) {
        return `on the ${getOrdinal(task.recurrenceDayOfMonth)}`;
      }
      return "monthly";
    
    case "monthly day":
      // Database uses ISO 8601 standard (1=Mon, 2=Tue, ..., 7=Sun), convert to getDayName format (0=Sun, 1=Mon, ..., 6=Sat)
      if (task.recurrenceWeekOfMonth != null && task.recurrenceDayOfWeekMonthly != null && 
          task.recurrenceDayOfWeekMonthly >= 1 && task.recurrenceDayOfWeekMonthly <= 7) {
        return `${getOrdinal(task.recurrenceWeekOfMonth)} ${getDayName(task.recurrenceDayOfWeekMonthly % 7)}`;
      }
      return "monthly";
    
    case "annually":
      if (task.recurrenceMonth != null && task.recurrenceDayOfMonth != null &&
          task.recurrenceMonth >= 1 && task.recurrenceMonth <= 12) {
        return `${task.recurrenceMonth}/${task.recurrenceDayOfMonth}`;
      }
      return "annually";
    
    case "full moon":
    case "new moon":
    case "every season":
    case "winter solstice":
    case "spring equinox":
    case "summer solstice":
    case "autumn equinox":
      return ""; // No prefix needed - these all occur on the same date
    
    default:
      return "";
  }
}
