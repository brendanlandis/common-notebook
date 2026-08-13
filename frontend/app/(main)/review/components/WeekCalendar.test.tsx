import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WeekCalendar, { toFullCalendarEvents } from "./WeekCalendar";
import type { ResolvedInstance } from "@/app/lib/ics/resolveDecisions";

/**
 * The claim the whole calendar design rests on: **handing FullCalendar
 * wall-clock values in UTC mode paints them unchanged.**
 *
 * `expandIcs` resolves every event to the owner's wall clock using Temporal, so
 * the grid must not apply a zone of its own on top. Rendering in the browser's
 * zone instead would be right on a laptop whose zone matches the setting and
 * wrong in production — the exact bug class this codebase has shipped three
 * times and now guards against.
 *
 * Which is why this suite only means anything **run across the TZ matrix**: the
 * assertions below pass trivially when the machine is already in New York. It's
 * the UTC and Kolkata runs that carry the proof.
 */

function instance(overrides: Partial<ResolvedInstance> = {}): ResolvedInstance {
  return {
    uid: "evt@test",
    recurrenceId: null,
    title: "Afternoon thing",
    allDay: false,
    start: "2026-01-12T14:00:00",
    end: "2026-01-12T15:00:00",
    state: "show",
    source: "instance",
    calendarDocumentId: "cal-1",
    ...overrides,
  };
}

const PERIOD = { periodStart: "2026-01-12", periodEnd: "2026-01-18" };

describe("toFullCalendarEvents", () => {
  it("passes the wall-clock strings through untouched", () => {
    // Any conversion here would be the second one, and therefore wrong.
    const [mapped] = toFullCalendarEvents([instance()]);

    expect(mapped.start).toBe("2026-01-12T14:00:00");
    expect(mapped.end).toBe("2026-01-12T15:00:00");
  });

  it("gives each state its own class", () => {
    const states = ["show", "hide", "unset"] as const;
    const mapped = toFullCalendarEvents(states.map((state) => instance({ state })));

    expect(mapped.map((m) => m.classNames[0])).toEqual([
      "cal-event-show",
      "cal-event-hide",
      "cal-event-unset",
    ]);
  });

  it("keeps ids unique when a uid repeats across calendars", () => {
    const mapped = toFullCalendarEvents([
      instance({ calendarDocumentId: "cal-1" }),
      instance({ calendarDocumentId: "cal-2" }),
    ]);

    expect(new Set(mapped.map((m) => m.id)).size).toBe(2);
  });

  it("falls back to a placeholder title rather than rendering blank", () => {
    expect(toFullCalendarEvents([instance({ title: "" })])[0].title).toBe("(no title)");
  });
});

describe("WeekCalendar", () => {
  it("paints an event at the wall-clock time it was given", () => {
    render(<WeekCalendar events={[instance()]} {...PERIOD} onCycle={vi.fn()} />);

    // 2pm, whatever zone the machine running this is in. A grid doing its own
    // conversion would show 9am here under TZ=UTC.
    expect(screen.getByText("Afternoon thing")).toBeTruthy();
    expect(screen.getByText(/^2(:00)?p/i)).toBeTruthy();
  });

  it("renders the period's days, not the current week", () => {
    const { container } = render(
      <WeekCalendar events={[instance()]} {...PERIOD} onCycle={vi.fn()} />
    );

    const headers = [...container.querySelectorAll(".fc-col-header-cell")].map(
      (cell) => cell.textContent
    );
    expect(headers).toHaveLength(7);
    expect(headers[0]).toContain("1/12");
    expect(headers[6]).toContain("1/18");
  });

  it("moves the grid when the period changes", () => {
    // The mode switch on the review page. `duration` is a reactive option and
    // `initialDate` is not, so this once grew a 4-day grid to 7 days without
    // moving it off today — showing "the next seven days" where the next week
    // belonged. The remount that hid it only happens the first time a period is
    // fetched; a period already in the query cache re-renders in place.
    const { container, rerender } = render(
      <WeekCalendar events={[]} periodStart="2026-01-15" periodEnd="2026-01-18" onCycle={vi.fn()} />
    );

    rerender(
      <WeekCalendar events={[]} periodStart="2026-01-19" periodEnd="2026-01-25" onCycle={vi.fn()} />
    );

    const headers = [...container.querySelectorAll(".fc-col-header-cell")].map(
      (cell) => cell.textContent
    );
    expect(headers).toHaveLength(7);
    expect(headers[0]).toContain("1/19");
    expect(headers[6]).toContain("1/25");
  });

  it("sizes the grid to a partial period", () => {
    // A mid-cycle re-review covers only the rest of the week.
    const { container } = render(
      <WeekCalendar
        events={[]}
        periodStart="2026-01-15"
        periodEnd="2026-01-18"
        onCycle={vi.fn()}
      />
    );

    expect(container.querySelectorAll(".fc-col-header-cell")).toHaveLength(4);
  });

  it("keeps an all-day event out of the timed grid", () => {
    const { container } = render(
      <WeekCalendar
        events={[
          instance({ title: "Whole day", allDay: true, start: "2026-01-14", end: "2026-01-15" }),
        ]}
        {...PERIOD}
        onCycle={vi.fn()}
      />
    );

    expect(screen.getByText("Whole day")).toBeTruthy();
    expect(container.querySelector(".fc-daygrid-body .fc-event")).toBeTruthy();
  });

  it("hands the clicked instance back to the caller", () => {
    const onCycle = vi.fn();
    const { container } = render(
      <WeekCalendar events={[instance()]} {...PERIOD} onCycle={onCycle} />
    );

    (container.querySelector(".fc-event") as HTMLElement | null)?.click();

    expect(onCycle).toHaveBeenCalledWith(expect.objectContaining({ uid: "evt@test" }));
  });
});
