import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TimeZoneSettings } from "@/app/lib/timeZoneSettings";

/**
 * Coverage for the task form's **recurrence block** — the part that turns the
 * user's choice of pattern into the payload handed to `onSubmit`.
 *
 * Written because that block had none. There are no unit tests for this form,
 * and `e2e/recurring.spec.ts` builds its task through `POST /api/tasks` rather
 * than the UI, so nothing anywhere exercised these selects. That is a bad place
 * to have a gap: `handleFormSubmit` nulls out the recurrence fields that don't
 * belong to the chosen type, and getting that wrong writes a task that looks
 * saved and recurs on the wrong schedule — the same shape as the
 * `projectType: 'normal'` bug, which survived 434 green tests for months.
 *
 * These tests pin the **payload contract**, not the markup, so the picker can be
 * lifted into its own component without rewriting them.
 *
 * `calculateNextRecurrence` is deliberately NOT mocked — the computed
 * displayDate is part of what the form produces. The clock is pinned instead,
 * which is the only thing a date-dependent suite here is allowed to stub.
 */

const EST: TimeZoneSettings = { timezone: "America/New_York", dayBoundaryHour: 4 };

vi.mock("@/app/contexts/DateTimeSettingsContext", () => ({
  useDateTimeSettings: () => ({
    timeZoneSettings: EST,
    completedTaskVisibilityMinutes: 0,
  }),
}));

// Only the wishlist-category suggestions read this, and none of these tests use
// a wishlist project.
vi.mock("../hooks/useTasks", () => ({ useTasks: () => ({ tasks: [] }) }));

// Both pull their own server state and neither participates in the recurrence
// payload. A null project keeps `selectedProjectType` null, which is what makes
// the recurring checkbox visible.
vi.mock("./ProjectSelector", () => ({ default: () => null }));
vi.mock("@/app/components/RichTextEditor", () => ({ default: () => null }));

import TaskForm from "./TaskForm";

/** Fill the title (the only other required field) and turn on recurrence. */
function renderRecurringForm() {
  const onSubmit = vi.fn();
  render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />);

  fireEvent.change(screen.getByLabelText("title"), {
    target: { value: "a recurring thing" },
  });
  fireEvent.click(screen.getByLabelText("recurring"));

  return onSubmit;
}

function selectRecurrence(type: string) {
  fireEvent.change(screen.getByLabelText("recurrence type"), {
    target: { value: type },
  });
}

async function submit(onSubmit: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole("button", { name: /create task/i }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  return onSubmit.mock.calls[0][0];
}

describe("TaskForm recurrence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Monday 5 Jan 2026, 15:00 in New York — comfortably past the 4am boundary,
    // so "today" is unambiguous whatever zone the machine running this is in.
    vi.setSystemTime(new Date("2026-01-05T20:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("sends recurrenceType none and no recurrence fields when not recurring", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "a one-off" },
    });

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      title: "a one-off",
      isRecurring: false,
      recurrenceType: "none",
      recurrenceDayOfWeek: null,
      recurrenceDayOfMonth: null,
      recurrenceWeekOfMonth: null,
      recurrenceDayOfWeekMonthly: null,
      recurrenceMonth: null,
    });
  });

  it("shows the recurrence picker only once recurring is checked", () => {
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText("recurrence type")).toBeNull();

    fireEvent.click(screen.getByLabelText("recurring"));
    expect(screen.getByLabelText("recurrence type")).toBeTruthy();
  });

  it("schedules a daily task for today on initial creation", async () => {
    const onSubmit = renderRecurringForm();
    selectRecurrence("daily");

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      isRecurring: true,
      recurrenceType: "daily",
      displayDate: "2026-01-05",
      dueDate: null,
    });
  });

  it("carries the chosen weekday for a weekly task and nulls the rest", async () => {
    const onSubmit = renderRecurringForm();
    selectRecurrence("weekly");
    fireEvent.change(screen.getByLabelText("day of week"), {
      target: { value: "4" }, // Thursday
    });

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      recurrenceType: "weekly",
      recurrenceDayOfWeek: 4,
      // Thursday after Monday 5 Jan.
      displayDate: "2026-01-08",
      recurrenceDayOfMonth: null,
      recurrenceWeekOfMonth: null,
      recurrenceDayOfWeekMonthly: null,
      recurrenceMonth: null,
    });
  });

  it("carries the interval for an every-x-days task", async () => {
    const onSubmit = renderRecurringForm();
    selectRecurrence("every x days");
    fireEvent.change(screen.getByLabelText("how many days"), {
      target: { value: "3" },
    });

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      recurrenceType: "every x days",
      recurrenceInterval: 3,
      displayDate: "2026-01-05", // initial creation shows today
    });
  });

  it("blocks submission when every-x-days has no interval", async () => {
    const onSubmit = renderRecurringForm();
    selectRecurrence("every x days");

    fireEvent.click(screen.getByRole("button", { name: /create task/i }));

    // The zod superRefine rejects it, so onSubmit never fires...
    await waitFor(() =>
      expect(screen.getByText(/interval is required/i)).toBeTruthy()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("says which recurrence field is missing rather than failing silently", async () => {
    // Every superRefine rule in this form used to fail with no message at all:
    // the create button did nothing, the drawer stayed open, and nothing said
    // why. Only title/displayDate/dueDate rendered their `errors.*`.
    const onSubmit = renderRecurringForm();
    selectRecurrence("monthly day");
    // Blank the week-of-month, which defaults to a valid 1.
    fireEvent.change(screen.getByLabelText("Week of Month"), { target: { value: "0" } });

    fireEvent.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() =>
      expect(screen.getByText(/week of month is required/i)).toBeTruthy()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("carries week-of-month and weekday for a monthly-day task", async () => {
    const onSubmit = renderRecurringForm();
    selectRecurrence("monthly day");
    fireEvent.change(screen.getByLabelText("Week of Month"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("day of week"), {
      target: { value: "2" }, // Tuesday
    });

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      recurrenceType: "monthly day",
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 2,
      recurrenceDayOfWeek: null,
      recurrenceMonth: null,
    });
  });

  it("supports 'the last' weekday of the month", async () => {
    // -1 is a sentinel, not an index — it survives the number coercion and the
    // payload's type-based nulling, and it is what makes findNthWeekdayOfMonth
    // walk back from the end of the month.
    const onSubmit = renderRecurringForm();
    selectRecurrence("monthly day");
    fireEvent.change(screen.getByLabelText("Week of Month"), {
      target: { value: "-1" },
    });
    fireEvent.change(screen.getByLabelText("day of week"), {
      target: { value: "5" }, // Friday
    });

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      recurrenceWeekOfMonth: -1,
      recurrenceDayOfWeekMonthly: 5,
      // With no offset the event date lands in displayDate and dueDate stays
      // null — "show it on the day" rather than "show it early, due then".
      displayDate: "2026-01-30", // the last Friday of January
      dueDate: null,
    });
  });

  it("carries month and day for an annual task", async () => {
    const onSubmit = renderRecurringForm();
    selectRecurrence("annually");
    fireEvent.change(screen.getByLabelText("month"), {
      target: { value: "3" }, // March
    });
    fireEvent.change(screen.getByLabelText("day of month"), {
      target: { value: "15" },
    });

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      recurrenceType: "annually",
      recurrenceMonth: 3,
      recurrenceDayOfMonth: 15,
      displayDate: "2026-03-15",
      dueDate: null,
      recurrenceDayOfWeek: null,
    });
  });

  it("offers the display offset only for event-based types, and sends it", async () => {
    const onSubmit = renderRecurringForm();

    // A weekday-cadence type has no event to offset from.
    selectRecurrence("weekly");
    expect(screen.queryByLabelText("when to display")).toBeNull();

    selectRecurrence("full moon");
    fireEvent.change(screen.getByLabelText("when to display"), {
      target: { value: "7" },
    });

    const payload = await submit(onSubmit);

    expect(payload).toMatchObject({
      recurrenceType: "full moon",
      displayDateOffset: 7,
    });
    // A week ahead of the event, which is what the offset means.
    expect(payload.displayDate < payload.dueDate).toBe(true);
  });

  it("sends a null offset for a type that has no event date", async () => {
    const onSubmit = renderRecurringForm();
    selectRecurrence("weekly");
    fireEvent.change(screen.getByLabelText("day of week"), {
      target: { value: "1" },
    });

    const payload = await submit(onSubmit);

    expect(payload.displayDateOffset).toBeNull();
  });
});
