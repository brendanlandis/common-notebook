"use client";

import type { RecurrenceType, RecurrenceRule } from "@/app/types/index";
import { hasEventDate } from "@/app/lib/recurrence";

/**
 * The recurrence pattern editor, as a controlled component.
 *
 * Lifted out of `TaskForm`, where it was ~200 lines of inline JSX wired
 * directly to that form's react-hook-form instance. It moved because tasks are
 * no longer the only thing with a recurrence: the periodic review's cadence
 * ("every other Monday", "every new moon", "the last Friday of the month") is
 * the same pattern language, and a second hand-written copy of these option
 * lists is how the two start disagreeing about what "monthly" offers.
 *
 * Deliberately **not** react-hook-form aware. The settings drawer doesn't use
 * RHF, so an RHF-coupled component could not have been shared at all; a plain
 * value/onChange pair works for both, and `TaskForm` bridges it to its form
 * state in one place.
 *
 * `onChange` always emits a whole `RecurrenceRule` — the caller replaces rather
 * than patches, so there is no partial-update path to get wrong. Fields that
 * belong to other recurrence types are left alone here and nulled by the
 * consumer when it builds its payload (see `TaskForm`'s `handleFormSubmit`),
 * which keeps "what the user last picked" available if they switch type and
 * switch back.
 */

const RECURRENCE_TYPE_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<{ value: RecurrenceType; label: string }>;
}> = [
  {
    label: "the earth",
    options: [
      { value: "daily", label: "every day" },
      { value: "every x days", label: "every X days" },
    ],
  },
  {
    label: "man's witless folly",
    options: [
      { value: "weekly", label: "weekly" },
      { value: "biweekly", label: "biweekly" },
      { value: "monthly date", label: "monthly (same date)" },
      { value: "monthly day", label: "monthly (same weekday)" },
      { value: "annually", label: "annually" },
    ],
  },
  {
    label: "the heavens",
    options: [
      { value: "full moon", label: "full moon" },
      { value: "new moon", label: "new moon" },
      { value: "every season", label: "every season" },
      { value: "winter solstice", label: "winter solstice" },
      { value: "spring equinox", label: "spring equinox" },
      { value: "summer solstice", label: "summer solstice" },
      { value: "autumn equinox", label: "autumn equinox" },
    ],
  },
];

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

// -1 is a sentinel meaning "the last matching weekday", not an index. It is what
// makes the recurrence engine walk back from the end of the month rather than
// count forward from the first.
const WEEK_OF_MONTH_OPTIONS = [
  { value: 1, label: "the first" },
  { value: 2, label: "the second" },
  { value: 3, label: "the third" },
  { value: -1, label: "the last" },
] as const;

const OFFSET_OPTIONS = [
  { value: 0, label: "day of" },
  { value: 3, label: "a few days before" },
  { value: 7, label: "a week before" },
  { value: 14, label: "two weeks before" },
  { value: 30, label: "a month before" },
] as const;

/**
 * February is 29 here on purpose: this drives a day-of-month picker, not a
 * calendar, so a leap day has to be selectable whatever year it happens to be.
 * The recurrence engine caps an out-of-range day to the real month length.
 */
const DAYS_IN_MONTH: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

export interface RecurrencePickerProps {
  value: RecurrenceRule;
  onChange: (next: RecurrenceRule) => void;
  /**
   * The "when to display" control, for callers that show the item ahead of the
   * date it points at. Tasks do; a review cadence has nothing to show early, so
   * it omits this and the control doesn't render.
   */
  offset?: { value: number; onChange: (offset: number) => void };
  /**
   * Validation messages, keyed by the field they belong to.
   *
   * Rendered beside the control rather than collected at the bottom of the form,
   * because the whole failure mode being fixed here is a user not knowing which
   * field the form is unhappy about.
   */
  errors?: Partial<Record<keyof RecurrenceRule, string | undefined>>;
}

export default function RecurrencePicker({
  value,
  onChange,
  offset,
  errors,
}: RecurrencePickerProps) {
  const type = value.recurrenceType;
  const set = (patch: Partial<RecurrenceRule>) => onChange({ ...value, ...patch });
  const error = (field: keyof RecurrenceRule) =>
    errors?.[field] ? <span className="error">{errors[field]}</span> : null;

  return (
    <>
      <div className="task-form-element">
        <label htmlFor="recurrenceType">recurrence type</label>
        <select
          id="recurrenceType"
          value={type}
          onChange={(e) => set({ recurrenceType: e.target.value as RecurrenceType })}
        >
          {RECURRENCE_TYPE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {type === "every x days" && (
        <div className="task-form-element">
          <label htmlFor="recurrenceInterval">how many days</label>
          <input
            id="recurrenceInterval"
            type="number"
            placeholder="how many days"
            value={value.recurrenceInterval ?? ""}
            onChange={(e) =>
              set({
                recurrenceInterval: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
          {error("recurrenceInterval")}
        </div>
      )}

      {(type === "weekly" || type === "biweekly") && (
        <div className="task-form-element">
          <label htmlFor="recurrenceDayOfWeek">day of week</label>
          <select
            id="recurrenceDayOfWeek"
            value={value.recurrenceDayOfWeek ?? 1}
            onChange={(e) => set({ recurrenceDayOfWeek: Number(e.target.value) })}
          >
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index + 1}>
                {type === "biweekly" ? `every other ${day}` : `${day}s`}
              </option>
            ))}
          </select>
          {error("recurrenceDayOfWeek")}
        </div>
      )}

      {type === "monthly date" && (
        <div className="task-form-element">
          <label htmlFor="recurrenceDayOfMonth">day of month (1-31)</label>
          <input
            id="recurrenceDayOfMonth"
            type="number"
            min="1"
            max="31"
            placeholder="day of month (1-31)"
            value={value.recurrenceDayOfMonth ?? ""}
            onChange={(e) =>
              set({
                recurrenceDayOfMonth: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
          {error("recurrenceDayOfMonth")}
        </div>
      )}

      {type === "monthly day" && (
        <div className="row-one-two">
          <div className="task-form-element">
            <label htmlFor="recurrenceWeekOfMonth">Week of Month</label>
            <select
              id="recurrenceWeekOfMonth"
              value={value.recurrenceWeekOfMonth ?? 1}
              onChange={(e) => set({ recurrenceWeekOfMonth: Number(e.target.value) })}
            >
              {WEEK_OF_MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error("recurrenceWeekOfMonth")}
          </div>
          <div className="task-form-element">
            <label htmlFor="recurrenceDayOfWeekMonthly">day of week</label>
            <select
              id="recurrenceDayOfWeekMonthly"
              value={value.recurrenceDayOfWeekMonthly ?? 1}
              onChange={(e) =>
                set({ recurrenceDayOfWeekMonthly: Number(e.target.value) })
              }
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index + 1}>
                  {day} of the month
                </option>
              ))}
            </select>
            {error("recurrenceDayOfWeekMonthly")}
          </div>
        </div>
      )}

      {type === "annually" && (
        <div className="row-one-one">
          <div className="task-form-element">
            <label htmlFor="recurrenceMonth">month</label>
            <select
              id="recurrenceMonth"
              value={value.recurrenceMonth ?? 1}
              onChange={(e) => set({ recurrenceMonth: Number(e.target.value) })}
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            {error("recurrenceMonth")}
          </div>
          <div className="task-form-element">
            <label htmlFor="recurrenceDayOfMonth">day of month</label>
            <select
              id="recurrenceDayOfMonth"
              value={value.recurrenceDayOfMonth ?? 1}
              onChange={(e) => set({ recurrenceDayOfMonth: Number(e.target.value) })}
            >
              {Array.from(
                { length: DAYS_IN_MONTH[value.recurrenceMonth ?? 1] ?? 31 },
                (_, i) => i + 1
              ).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {offset && hasEventDate(type) && (
        <div className="task-form-element labeled">
          <label htmlFor="displayDateOffset">when to display</label>
          <select
            id="displayDateOffset"
            value={offset.value}
            onChange={(e) => offset.onChange(Number(e.target.value))}
          >
            {OFFSET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
