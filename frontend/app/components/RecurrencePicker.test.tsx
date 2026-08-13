import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RecurrenceRule } from "@/app/types/index";
import RecurrencePicker from "./RecurrencePicker";

/**
 * The picker's own contract, independent of any form.
 *
 * `TaskForm.test.tsx` already covers it end-to-end through the task form; these
 * cover the parts that form can't reach — chiefly the **offsetless** mode, which
 * is how the review cadence will use it. That path has no other caller yet, so
 * without this it would ship untested.
 */

const RULE: RecurrenceRule = {
  isRecurring: true,
  recurrenceType: "weekly",
  recurrenceInterval: null,
  recurrenceDayOfWeek: 1,
  recurrenceDayOfMonth: null,
  recurrenceWeekOfMonth: null,
  recurrenceDayOfWeekMonthly: null,
  recurrenceMonth: null,
};

function renderPicker(overrides: Partial<RecurrenceRule> = {}, withOffset = false) {
  const onChange = vi.fn();
  const value = { ...RULE, ...overrides };
  render(
    <RecurrencePicker
      value={value}
      onChange={onChange}
      offset={withOffset ? { value: 0, onChange: vi.fn() } : undefined}
    />
  );
  return { onChange, value };
}

describe("RecurrencePicker", () => {
  it("emits a whole rule, not a patch", () => {
    // The caller replaces rather than merges, so a partial emit would silently
    // drop every other field.
    const { onChange, value } = renderPicker();

    fireEvent.change(screen.getByLabelText("recurrence type"), {
      target: { value: "monthly day" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      recurrenceType: "monthly day",
    });
  });

  it("leaves other types' fields alone when switching type", () => {
    // Switching away and back shouldn't lose what was picked. Nulling belongs to
    // the consumer's payload step, not to the editor.
    const { onChange } = renderPicker({
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 4,
      recurrenceMonth: 7,
    });

    fireEvent.change(screen.getByLabelText("recurrence type"), {
      target: { value: "annually" },
    });

    expect(onChange.mock.calls[0][0]).toMatchObject({
      recurrenceDayOfWeek: 4,
      recurrenceMonth: 7,
    });
  });

  it("hides the offset control when no offset handler is given", () => {
    // The review cadence has nothing to display early, so it omits `offset`.
    // "full moon" is event-based, so this is the case that would otherwise show.
    renderPicker({ recurrenceType: "full moon" }, false);

    expect(screen.queryByLabelText("when to display")).toBeNull();
  });

  it("shows the offset control for an event-based type when asked", () => {
    renderPicker({ recurrenceType: "full moon" }, true);

    expect(screen.getByLabelText("when to display")).toBeTruthy();
  });

  it("hides the offset control for a cadence type even when asked", () => {
    // Weekly has no event to be early for, so the control is meaningless.
    renderPicker({ recurrenceType: "weekly" }, true);

    expect(screen.queryByLabelText("when to display")).toBeNull();
  });

  it("labels the weekday list differently for biweekly", () => {
    // One shared block renders both; the copy is the only thing that differs.
    renderPicker({ recurrenceType: "biweekly" });

    expect(screen.getByRole("option", { name: "every other monday" })).toBeTruthy();
  });

  it("offers 'the last' as -1 rather than an index", () => {
    const { onChange } = renderPicker({ recurrenceType: "monthly day" });

    fireEvent.change(screen.getByLabelText("Week of Month"), {
      target: { value: "-1" },
    });

    expect(onChange.mock.calls[0][0].recurrenceWeekOfMonth).toBe(-1);
  });

  it("offers 29 days in February so a leap day stays pickable", () => {
    renderPicker({ recurrenceType: "annually", recurrenceMonth: 2 });

    expect(screen.getByRole("option", { name: "29" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "30" })).toBeNull();
  });

  it("clears a blank interval to null rather than NaN", () => {
    // Number("") is 0 and parseInt("") is NaN; either would reach the engine as
    // a real interval and quietly schedule wrong.
    const { onChange } = renderPicker({
      recurrenceType: "every x days",
      recurrenceInterval: 3,
    });

    fireEvent.change(screen.getByLabelText("how many days"), {
      target: { value: "" },
    });

    expect(onChange.mock.calls[0][0].recurrenceInterval).toBeNull();
  });
});
