import type { Todo } from "@/app/types/index";

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
 * Generates a recurrence prefix for a todo item based on its recurrence type
 * @param todo - The todo item
 * @returns A human-readable recurrence prefix (e.g., "every day", "every 2 days", "every sunday")
 */
export function getRecurrencePrefix(todo: Todo): string {
  switch (todo.recurrenceType) {
    case "daily":
      return "every day";
    
    case "every x days":
      if (todo.recurrenceInterval != null && todo.recurrenceInterval > 0) {
        return `every ${todo.recurrenceInterval} days`;
      }
      return "every x days";
    
    case "weekly":
      // Database uses ISO 8601 standard (1=Mon, 2=Tue, ..., 7=Sun), convert to getDayName format (0=Sun, 1=Mon, ..., 6=Sat)
      if (todo.recurrenceDayOfWeek != null && todo.recurrenceDayOfWeek >= 1 && todo.recurrenceDayOfWeek <= 7) {
        return `every ${getDayName(todo.recurrenceDayOfWeek % 7)}`;
      }
      return "weekly";
    
    case "biweekly":
      // Database uses ISO 8601 standard (1=Mon, 2=Tue, ..., 7=Sun), convert to getDayName format (0=Sun, 1=Mon, ..., 6=Sat)
      if (todo.recurrenceDayOfWeek != null && todo.recurrenceDayOfWeek >= 1 && todo.recurrenceDayOfWeek <= 7) {
        return `every other ${getDayName(todo.recurrenceDayOfWeek % 7)}`;
      }
      return "biweekly";
    
    case "monthly date":
      if (todo.recurrenceDayOfMonth != null && todo.recurrenceDayOfMonth >= 1 && todo.recurrenceDayOfMonth <= 31) {
        return `on the ${getOrdinal(todo.recurrenceDayOfMonth)}`;
      }
      return "monthly";
    
    case "monthly day":
      // Database uses ISO 8601 standard (1=Mon, 2=Tue, ..., 7=Sun), convert to getDayName format (0=Sun, 1=Mon, ..., 6=Sat)
      if (todo.recurrenceWeekOfMonth != null && todo.recurrenceDayOfWeekMonthly != null && 
          todo.recurrenceDayOfWeekMonthly >= 1 && todo.recurrenceDayOfWeekMonthly <= 7) {
        return `${getOrdinal(todo.recurrenceWeekOfMonth)} ${getDayName(todo.recurrenceDayOfWeekMonthly % 7)}`;
      }
      return "monthly";
    
    case "annually":
      if (todo.recurrenceMonth != null && todo.recurrenceDayOfMonth != null &&
          todo.recurrenceMonth >= 1 && todo.recurrenceMonth <= 12) {
        return `${todo.recurrenceMonth}/${todo.recurrenceDayOfMonth}`;
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
