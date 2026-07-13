import { describe, it, expect } from "vitest";
import { getDayName, getOrdinal, getMonthName, getRecurrencePrefix } from "./recurrenceLabels";
import type { Task } from "@/app/types/index";

describe("getDayName", () => {
  it("should return correct day names for 0-6", () => {
    expect(getDayName(0)).toBe("sunday");
    expect(getDayName(1)).toBe("monday");
    expect(getDayName(2)).toBe("tuesday");
    expect(getDayName(3)).toBe("wednesday");
    expect(getDayName(4)).toBe("thursday");
    expect(getDayName(5)).toBe("friday");
    expect(getDayName(6)).toBe("saturday");
  });

  it("should return 'unknown' for invalid indices", () => {
    expect(getDayName(-1)).toBe("unknown");
    expect(getDayName(7)).toBe("unknown");
    expect(getDayName(100)).toBe("unknown");
  });

  it("should return 'unknown' for null or undefined", () => {
    expect(getDayName(null)).toBe("unknown");
    expect(getDayName(undefined)).toBe("unknown");
  });
});

describe("getOrdinal", () => {
  it("should return correct ordinals for 1st, 2nd, 3rd", () => {
    expect(getOrdinal(1)).toBe("1st");
    expect(getOrdinal(2)).toBe("2nd");
    expect(getOrdinal(3)).toBe("3rd");
  });

  it("should return 'th' for 4-20", () => {
    expect(getOrdinal(4)).toBe("4th");
    expect(getOrdinal(10)).toBe("10th");
    expect(getOrdinal(11)).toBe("11th");
    expect(getOrdinal(12)).toBe("12th");
    expect(getOrdinal(13)).toBe("13th");
    expect(getOrdinal(20)).toBe("20th");
  });

  it("should handle 21st, 22nd, 23rd correctly", () => {
    expect(getOrdinal(21)).toBe("21st");
    expect(getOrdinal(22)).toBe("22nd");
    expect(getOrdinal(23)).toBe("23rd");
  });

  it("should handle 31st correctly", () => {
    expect(getOrdinal(31)).toBe("31st");
  });

  it("should handle 111th, 112th, 113th correctly", () => {
    expect(getOrdinal(111)).toBe("111th");
    expect(getOrdinal(112)).toBe("112th");
    expect(getOrdinal(113)).toBe("113th");
  });
});

describe("getMonthName", () => {
  it("should return correct month names for 1-12", () => {
    expect(getMonthName(1)).toBe("january");
    expect(getMonthName(2)).toBe("february");
    expect(getMonthName(3)).toBe("march");
    expect(getMonthName(4)).toBe("april");
    expect(getMonthName(5)).toBe("may");
    expect(getMonthName(6)).toBe("june");
    expect(getMonthName(7)).toBe("july");
    expect(getMonthName(8)).toBe("august");
    expect(getMonthName(9)).toBe("september");
    expect(getMonthName(10)).toBe("october");
    expect(getMonthName(11)).toBe("november");
    expect(getMonthName(12)).toBe("december");
  });

  it("should return 'unknown' for invalid indices", () => {
    expect(getMonthName(0)).toBe("unknown");
    expect(getMonthName(13)).toBe("unknown");
    expect(getMonthName(-1)).toBe("unknown");
  });

  it("should return 'unknown' for null or undefined", () => {
    expect(getMonthName(null)).toBe("unknown");
    expect(getMonthName(undefined)).toBe("unknown");
  });
});

describe("getRecurrencePrefix", () => {
  const baseTask: Partial<Task> = {
    documentId: "test-123",
    title: "Test Task",
    completed: false,
    isRecurring: true,
  };

  it("should return 'every day' for daily recurrence", () => {
    const task = { ...baseTask, recurrenceType: "daily" } as Task;
    expect(getRecurrencePrefix(task)).toBe("every day");
  });

  it("should return 'every X days' for every x days recurrence", () => {
    const task = {
      ...baseTask,
      recurrenceType: "every x days",
      recurrenceInterval: 2,
    } as Task;
    expect(getRecurrencePrefix(task)).toBe("every 2 days");

    const task14 = {
      ...baseTask,
      recurrenceType: "every x days",
      recurrenceInterval: 14,
    } as Task;
    expect(getRecurrencePrefix(task14)).toBe("every 14 days");
  });

  it("should return 'every [day]' for weekly recurrence", () => {
    const task = {
      ...baseTask,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 7, // Database uses ISO 8601: 7=Sunday
    } as Task;
    expect(getRecurrencePrefix(task)).toBe("every sunday");

    const taskThursday = {
      ...baseTask,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 4, // ISO 8601: 4=Thursday
    } as Task;
    expect(getRecurrencePrefix(taskThursday)).toBe("every thursday");
  });

  it("should return 'every other [day]' for biweekly recurrence", () => {
    const task = {
      ...baseTask,
      recurrenceType: "biweekly",
      recurrenceDayOfWeek: 1, // Database uses ISO 8601: 1=Monday
    } as Task;
    expect(getRecurrencePrefix(task)).toBe("every other monday");

    const taskFriday = {
      ...baseTask,
      recurrenceType: "biweekly",
      recurrenceDayOfWeek: 5, // ISO 8601: 5=Friday
    } as Task;
    expect(getRecurrencePrefix(taskFriday)).toBe("every other friday");
  });

  it("should return 'on the [ordinal]' for monthly date recurrence", () => {
    const task = {
      ...baseTask,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 1,
    } as Task;
    expect(getRecurrencePrefix(task)).toBe("on the 1st");

    const task15 = {
      ...baseTask,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 15,
    } as Task;
    expect(getRecurrencePrefix(task15)).toBe("on the 15th");
  });

  it("should return '[ordinal] [day]' for monthly day recurrence", () => {
    const task = {
      ...baseTask,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 1, // Database uses ISO 8601: 1=Monday
    } as Task;
    expect(getRecurrencePrefix(task)).toBe("2nd monday");

    const task3rd = {
      ...baseTask,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 3,
      recurrenceDayOfWeekMonthly: 5, // ISO 8601: 5=Friday
    } as Task;
    expect(getRecurrencePrefix(task3rd)).toBe("3rd friday");
  });

  it("should return 'M/D' format for annually recurrence", () => {
    const task = {
      ...baseTask,
      recurrenceType: "annually",
      recurrenceMonth: 7,
      recurrenceDayOfMonth: 15,
    } as Task;
    expect(getRecurrencePrefix(task)).toBe("7/15");

    const taskJan1 = {
      ...baseTask,
      recurrenceType: "annually",
      recurrenceMonth: 1,
      recurrenceDayOfMonth: 1,
    } as Task;
    expect(getRecurrencePrefix(taskJan1)).toBe("1/1");

    const taskApr1 = {
      ...baseTask,
      recurrenceType: "annually",
      recurrenceMonth: 4,
      recurrenceDayOfMonth: 1,
    } as Task;
    expect(getRecurrencePrefix(taskApr1)).toBe("4/1");
  });

  it("should return empty string for full moon recurrence (no prefix needed)", () => {
    const task = { ...baseTask, recurrenceType: "full moon" } as Task;
    expect(getRecurrencePrefix(task)).toBe("");
  });

  it("should return empty string for new moon recurrence (no prefix needed)", () => {
    const task = { ...baseTask, recurrenceType: "new moon" } as Task;
    expect(getRecurrencePrefix(task)).toBe("");
  });

  it("should return empty string for every season recurrence (no prefix needed)", () => {
    const task = { ...baseTask, recurrenceType: "every season" } as Task;
    expect(getRecurrencePrefix(task)).toBe("");
  });

  it("should return empty string for seasonal recurrences (no prefix needed)", () => {
    const taskWinter = { ...baseTask, recurrenceType: "winter solstice" } as Task;
    expect(getRecurrencePrefix(taskWinter)).toBe("");

    const taskSpring = { ...baseTask, recurrenceType: "spring equinox" } as Task;
    expect(getRecurrencePrefix(taskSpring)).toBe("");

    const taskSummer = { ...baseTask, recurrenceType: "summer solstice" } as Task;
    expect(getRecurrencePrefix(taskSummer)).toBe("");

    const taskAutumn = { ...baseTask, recurrenceType: "autumn equinox" } as Task;
    expect(getRecurrencePrefix(taskAutumn)).toBe("");
  });

  it("should return fallback labels when required fields are null", () => {
    const taskWeekly = {
      ...baseTask,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: null,
    } as Task;
    expect(getRecurrencePrefix(taskWeekly)).toBe("weekly");

    const taskMonthlyDate = {
      ...baseTask,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: null,
    } as Task;
    expect(getRecurrencePrefix(taskMonthlyDate)).toBe("monthly");

    const taskAnnually = {
      ...baseTask,
      recurrenceType: "annually",
      recurrenceMonth: null,
      recurrenceDayOfMonth: null,
    } as Task;
    expect(getRecurrencePrefix(taskAnnually)).toBe("annually");
  });

  it("should return fallback labels when day of week is invalid", () => {
    const taskWeeklyInvalid = {
      ...baseTask,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 8, // Invalid: should be 1-7
    } as Task;
    expect(getRecurrencePrefix(taskWeeklyInvalid)).toBe("weekly");

    const taskWeeklyZero = {
      ...baseTask,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 0, // Invalid: should be 1-7 (database uses 1-based)
    } as Task;
    expect(getRecurrencePrefix(taskWeeklyZero)).toBe("weekly");

    const taskWeeklyNegative = {
      ...baseTask,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: -1, // Invalid: should be 1-7
    } as Task;
    expect(getRecurrencePrefix(taskWeeklyNegative)).toBe("weekly");

    const taskWeeklyUndefined = {
      ...baseTask,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: undefined,
    } as any;
    expect(getRecurrencePrefix(taskWeeklyUndefined)).toBe("weekly");
  });

  it("should return fallback labels for biweekly with invalid day of week", () => {
    const taskBiweeklyInvalid = {
      ...baseTask,
      recurrenceType: "biweekly",
      recurrenceDayOfWeek: 10,
    } as Task;
    expect(getRecurrencePrefix(taskBiweeklyInvalid)).toBe("biweekly");
  });

  it("should return fallback label when every x days interval is invalid", () => {
    const taskEveryXDaysNull = {
      ...baseTask,
      recurrenceType: "every x days",
      recurrenceInterval: null,
    } as Task;
    expect(getRecurrencePrefix(taskEveryXDaysNull)).toBe("every x days");

    const taskEveryXDaysZero = {
      ...baseTask,
      recurrenceType: "every x days",
      recurrenceInterval: 0,
    } as Task;
    expect(getRecurrencePrefix(taskEveryXDaysZero)).toBe("every x days");

    const taskEveryXDaysNegative = {
      ...baseTask,
      recurrenceType: "every x days",
      recurrenceInterval: -5,
    } as Task;
    expect(getRecurrencePrefix(taskEveryXDaysNegative)).toBe("every x days");
  });

  it("should return fallback label for monthly date with invalid day", () => {
    const taskMonthlyDateInvalid = {
      ...baseTask,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 32, // Invalid: should be 1-31
    } as Task;
    expect(getRecurrencePrefix(taskMonthlyDateInvalid)).toBe("monthly");

    const taskMonthlyDateZero = {
      ...baseTask,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 0,
    } as Task;
    expect(getRecurrencePrefix(taskMonthlyDateZero)).toBe("monthly");
  });

  it("should return fallback label for monthly day with invalid day of week", () => {
    const taskMonthlyDayInvalid = {
      ...baseTask,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 8, // Invalid: should be 1-7
    } as Task;
    expect(getRecurrencePrefix(taskMonthlyDayInvalid)).toBe("monthly");

    const taskMonthlyDayZero = {
      ...baseTask,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 0, // Invalid: should be 1-7 (database uses 1-based)
    } as Task;
    expect(getRecurrencePrefix(taskMonthlyDayZero)).toBe("monthly");
  });

  it("should return fallback label for annually with invalid month", () => {
    const taskAnnuallyInvalidMonth = {
      ...baseTask,
      recurrenceType: "annually",
      recurrenceMonth: 13, // Invalid: should be 1-12
      recurrenceDayOfMonth: 15,
    } as Task;
    expect(getRecurrencePrefix(taskAnnuallyInvalidMonth)).toBe("annually");

    const taskAnnuallyZeroMonth = {
      ...baseTask,
      recurrenceType: "annually",
      recurrenceMonth: 0,
      recurrenceDayOfMonth: 15,
    } as Task;
    expect(getRecurrencePrefix(taskAnnuallyZeroMonth)).toBe("annually");
  });
});

// Regression tests for ISO 8601 day-of-week conversion bug
// Bug: Sunday (day 7) was incorrectly displayed as "saturday" due to incorrect conversion formula
// Fix: Changed from `dayOfWeek - 1` to `dayOfWeek % 7` to correctly map ISO 8601 (1-7) to 0-based (0-6)
describe("ISO 8601 day-of-week conversion regression tests", () => {
  const baseTask = {
    documentId: "test-doc-id",
    id: 123,
    title: "Test task",
    completed: false,
    displayDate: "2024-01-01",
  };

  describe("weekly recurrence", () => {
    it("should correctly convert all ISO 8601 day values (1-7) to day names", () => {
      // ISO 8601: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
      const testCases = [
        { dayOfWeek: 1, expected: "every monday" },
        { dayOfWeek: 2, expected: "every tuesday" },
        { dayOfWeek: 3, expected: "every wednesday" },
        { dayOfWeek: 4, expected: "every thursday" },
        { dayOfWeek: 5, expected: "every friday" },
        { dayOfWeek: 6, expected: "every saturday" },
        { dayOfWeek: 7, expected: "every sunday" }, // Regression: This was showing "every saturday"
      ];

      testCases.forEach(({ dayOfWeek, expected }) => {
        const task = {
          ...baseTask,
          recurrenceType: "weekly",
          recurrenceDayOfWeek: dayOfWeek,
        } as Task;
        expect(getRecurrencePrefix(task)).toBe(expected);
      });
    });
  });

  describe("biweekly recurrence", () => {
    it("should correctly convert all ISO 8601 day values (1-7) to day names", () => {
      const testCases = [
        { dayOfWeek: 1, expected: "every other monday" },
        { dayOfWeek: 2, expected: "every other tuesday" },
        { dayOfWeek: 3, expected: "every other wednesday" },
        { dayOfWeek: 4, expected: "every other thursday" },
        { dayOfWeek: 5, expected: "every other friday" },
        { dayOfWeek: 6, expected: "every other saturday" },
        { dayOfWeek: 7, expected: "every other sunday" }, // Regression: This was showing "every other saturday"
      ];

      testCases.forEach(({ dayOfWeek, expected }) => {
        const task = {
          ...baseTask,
          recurrenceType: "biweekly",
          recurrenceDayOfWeek: dayOfWeek,
        } as Task;
        expect(getRecurrencePrefix(task)).toBe(expected);
      });
    });
  });

  describe("monthly day recurrence", () => {
    it("should correctly convert all ISO 8601 day values (1-7) to day names", () => {
      const testCases = [
        { dayOfWeek: 1, expected: "1st monday" },
        { dayOfWeek: 2, expected: "1st tuesday" },
        { dayOfWeek: 3, expected: "1st wednesday" },
        { dayOfWeek: 4, expected: "1st thursday" },
        { dayOfWeek: 5, expected: "1st friday" },
        { dayOfWeek: 6, expected: "1st saturday" },
        { dayOfWeek: 7, expected: "1st sunday" }, // Regression: This was showing "1st saturday"
      ];

      testCases.forEach(({ dayOfWeek, expected }) => {
        const task = {
          ...baseTask,
          recurrenceType: "monthly day",
          recurrenceWeekOfMonth: 1,
          recurrenceDayOfWeekMonthly: dayOfWeek,
        } as Task;
        expect(getRecurrencePrefix(task)).toBe(expected);
      });
    });
  });
});
