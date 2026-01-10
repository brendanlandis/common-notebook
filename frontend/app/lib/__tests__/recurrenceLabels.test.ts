import { describe, it, expect } from "vitest";
import { getDayName, getOrdinal, getMonthName, getRecurrencePrefix } from "../recurrenceLabels";
import type { Todo } from "@/app/types/index";

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
  const baseTodo: Partial<Todo> = {
    documentId: "test-123",
    title: "Test Todo",
    completed: false,
    isRecurring: true,
  };

  it("should return 'every day' for daily recurrence", () => {
    const todo = { ...baseTodo, recurrenceType: "daily" } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("every day");
  });

  it("should return 'every X days' for every x days recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "every x days",
      recurrenceInterval: 2,
    } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("every 2 days");

    const todo14 = {
      ...baseTodo,
      recurrenceType: "every x days",
      recurrenceInterval: 14,
    } as Todo;
    expect(getRecurrencePrefix(todo14)).toBe("every 14 days");
  });

  it("should return 'every [day]' for weekly recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 7, // Database uses ISO 8601: 7=Sunday
    } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("every sunday");

    const todoThursday = {
      ...baseTodo,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 4, // ISO 8601: 4=Thursday
    } as Todo;
    expect(getRecurrencePrefix(todoThursday)).toBe("every thursday");
  });

  it("should return 'every other [day]' for biweekly recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "biweekly",
      recurrenceDayOfWeek: 1, // Database uses ISO 8601: 1=Monday
    } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("every other monday");

    const todoFriday = {
      ...baseTodo,
      recurrenceType: "biweekly",
      recurrenceDayOfWeek: 5, // ISO 8601: 5=Friday
    } as Todo;
    expect(getRecurrencePrefix(todoFriday)).toBe("every other friday");
  });

  it("should return 'on the [ordinal]' for monthly date recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 1,
    } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("on the 1st");

    const todo15 = {
      ...baseTodo,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 15,
    } as Todo;
    expect(getRecurrencePrefix(todo15)).toBe("on the 15th");
  });

  it("should return '[ordinal] [day]' for monthly day recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 1, // Database uses ISO 8601: 1=Monday
    } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("2nd monday");

    const todo3rd = {
      ...baseTodo,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 3,
      recurrenceDayOfWeekMonthly: 5, // ISO 8601: 5=Friday
    } as Todo;
    expect(getRecurrencePrefix(todo3rd)).toBe("3rd friday");
  });

  it("should return 'M/D' format for annually recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "annually",
      recurrenceMonth: 7,
      recurrenceDayOfMonth: 15,
    } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("7/15");

    const todoJan1 = {
      ...baseTodo,
      recurrenceType: "annually",
      recurrenceMonth: 1,
      recurrenceDayOfMonth: 1,
    } as Todo;
    expect(getRecurrencePrefix(todoJan1)).toBe("1/1");

    const todoApr1 = {
      ...baseTodo,
      recurrenceType: "annually",
      recurrenceMonth: 4,
      recurrenceDayOfMonth: 1,
    } as Todo;
    expect(getRecurrencePrefix(todoApr1)).toBe("4/1");
  });

  it("should return empty string for full moon recurrence (no prefix needed)", () => {
    const todo = { ...baseTodo, recurrenceType: "full moon" } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("");
  });

  it("should return empty string for new moon recurrence (no prefix needed)", () => {
    const todo = { ...baseTodo, recurrenceType: "new moon" } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("");
  });

  it("should return empty string for every season recurrence (no prefix needed)", () => {
    const todo = { ...baseTodo, recurrenceType: "every season" } as Todo;
    expect(getRecurrencePrefix(todo)).toBe("");
  });

  it("should return empty string for seasonal recurrences (no prefix needed)", () => {
    const todoWinter = { ...baseTodo, recurrenceType: "winter solstice" } as Todo;
    expect(getRecurrencePrefix(todoWinter)).toBe("");

    const todoSpring = { ...baseTodo, recurrenceType: "spring equinox" } as Todo;
    expect(getRecurrencePrefix(todoSpring)).toBe("");

    const todoSummer = { ...baseTodo, recurrenceType: "summer solstice" } as Todo;
    expect(getRecurrencePrefix(todoSummer)).toBe("");

    const todoAutumn = { ...baseTodo, recurrenceType: "autumn equinox" } as Todo;
    expect(getRecurrencePrefix(todoAutumn)).toBe("");
  });

  it("should return fallback labels when required fields are null", () => {
    const todoWeekly = {
      ...baseTodo,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: null,
    } as Todo;
    expect(getRecurrencePrefix(todoWeekly)).toBe("weekly");

    const todoMonthlyDate = {
      ...baseTodo,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: null,
    } as Todo;
    expect(getRecurrencePrefix(todoMonthlyDate)).toBe("monthly");

    const todoAnnually = {
      ...baseTodo,
      recurrenceType: "annually",
      recurrenceMonth: null,
      recurrenceDayOfMonth: null,
    } as Todo;
    expect(getRecurrencePrefix(todoAnnually)).toBe("annually");
  });

  it("should return fallback labels when day of week is invalid", () => {
    const todoWeeklyInvalid = {
      ...baseTodo,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 8, // Invalid: should be 1-7
    } as Todo;
    expect(getRecurrencePrefix(todoWeeklyInvalid)).toBe("weekly");

    const todoWeeklyZero = {
      ...baseTodo,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 0, // Invalid: should be 1-7 (database uses 1-based)
    } as Todo;
    expect(getRecurrencePrefix(todoWeeklyZero)).toBe("weekly");

    const todoWeeklyNegative = {
      ...baseTodo,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: -1, // Invalid: should be 1-7
    } as Todo;
    expect(getRecurrencePrefix(todoWeeklyNegative)).toBe("weekly");

    const todoWeeklyUndefined = {
      ...baseTodo,
      recurrenceType: "weekly",
      recurrenceDayOfWeek: undefined,
    } as any;
    expect(getRecurrencePrefix(todoWeeklyUndefined)).toBe("weekly");
  });

  it("should return fallback labels for biweekly with invalid day of week", () => {
    const todoBiweeklyInvalid = {
      ...baseTodo,
      recurrenceType: "biweekly",
      recurrenceDayOfWeek: 10,
    } as Todo;
    expect(getRecurrencePrefix(todoBiweeklyInvalid)).toBe("biweekly");
  });

  it("should return fallback label when every x days interval is invalid", () => {
    const todoEveryXDaysNull = {
      ...baseTodo,
      recurrenceType: "every x days",
      recurrenceInterval: null,
    } as Todo;
    expect(getRecurrencePrefix(todoEveryXDaysNull)).toBe("every x days");

    const todoEveryXDaysZero = {
      ...baseTodo,
      recurrenceType: "every x days",
      recurrenceInterval: 0,
    } as Todo;
    expect(getRecurrencePrefix(todoEveryXDaysZero)).toBe("every x days");

    const todoEveryXDaysNegative = {
      ...baseTodo,
      recurrenceType: "every x days",
      recurrenceInterval: -5,
    } as Todo;
    expect(getRecurrencePrefix(todoEveryXDaysNegative)).toBe("every x days");
  });

  it("should return fallback label for monthly date with invalid day", () => {
    const todoMonthlyDateInvalid = {
      ...baseTodo,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 32, // Invalid: should be 1-31
    } as Todo;
    expect(getRecurrencePrefix(todoMonthlyDateInvalid)).toBe("monthly");

    const todoMonthlyDateZero = {
      ...baseTodo,
      recurrenceType: "monthly date",
      recurrenceDayOfMonth: 0,
    } as Todo;
    expect(getRecurrencePrefix(todoMonthlyDateZero)).toBe("monthly");
  });

  it("should return fallback label for monthly day with invalid day of week", () => {
    const todoMonthlyDayInvalid = {
      ...baseTodo,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 8, // Invalid: should be 1-7
    } as Todo;
    expect(getRecurrencePrefix(todoMonthlyDayInvalid)).toBe("monthly");

    const todoMonthlyDayZero = {
      ...baseTodo,
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 0, // Invalid: should be 1-7 (database uses 1-based)
    } as Todo;
    expect(getRecurrencePrefix(todoMonthlyDayZero)).toBe("monthly");
  });

  it("should return fallback label for annually with invalid month", () => {
    const todoAnnuallyInvalidMonth = {
      ...baseTodo,
      recurrenceType: "annually",
      recurrenceMonth: 13, // Invalid: should be 1-12
      recurrenceDayOfMonth: 15,
    } as Todo;
    expect(getRecurrencePrefix(todoAnnuallyInvalidMonth)).toBe("annually");

    const todoAnnuallyZeroMonth = {
      ...baseTodo,
      recurrenceType: "annually",
      recurrenceMonth: 0,
      recurrenceDayOfMonth: 15,
    } as Todo;
    expect(getRecurrencePrefix(todoAnnuallyZeroMonth)).toBe("annually");
  });
});

// Regression tests for ISO 8601 day-of-week conversion bug
// Bug: Sunday (day 7) was incorrectly displayed as "saturday" due to incorrect conversion formula
// Fix: Changed from `dayOfWeek - 1` to `dayOfWeek % 7` to correctly map ISO 8601 (1-7) to 0-based (0-6)
describe("ISO 8601 day-of-week conversion regression tests", () => {
  const baseTodo = {
    documentId: "test-doc-id",
    id: 123,
    title: "Test todo",
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
        const todo = {
          ...baseTodo,
          recurrenceType: "weekly",
          recurrenceDayOfWeek: dayOfWeek,
        } as Todo;
        expect(getRecurrencePrefix(todo)).toBe(expected);
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
        const todo = {
          ...baseTodo,
          recurrenceType: "biweekly",
          recurrenceDayOfWeek: dayOfWeek,
        } as Todo;
        expect(getRecurrencePrefix(todo)).toBe(expected);
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
        const todo = {
          ...baseTodo,
          recurrenceType: "monthly day",
          recurrenceWeekOfMonth: 1,
          recurrenceDayOfWeekMonthly: dayOfWeek,
        } as Todo;
        expect(getRecurrencePrefix(todo)).toBe(expected);
      });
    });
  });
});
