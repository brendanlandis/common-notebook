import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WeekCalendar, {
  slotWindow,
  toFullCalendarEvents,
  toSunsetEvents,
} from "./WeekCalendar";
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

// A wall clock inside the period, so "today" lands on a column the grid shows.
const NOW = "2026-01-14T20:00:00";

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

describe("slotWindow", () => {
  it("starts at 9am when nothing is earlier", () => {
    expect(slotWindow([instance()]).min).toBe("09:00:00");
  });

  it("opens earlier for an early event", () => {
    expect(
      slotWindow([instance({ start: "2026-01-12T06:30:00", end: "2026-01-12T07:00:00" })]).min
    ).toBe("06:00:00");
  });

  it("ignores an ignored event", () => {
    // Deciding to ignore the 6am thing is exactly the statement that it
    // shouldn't stretch the picture of the day.
    expect(
      slotWindow([
        instance({ state: "hide", start: "2026-01-12T06:00:00", end: "2026-01-12T07:00:00" }),
      ]).min
    ).toBe("09:00:00");
  });

  it("opens earlier for an undecided one", () => {
    expect(
      slotWindow([
        instance({ state: "unset", start: "2026-01-12T07:00:00", end: "2026-01-12T08:00:00" }),
      ]).min
    ).toBe("07:00:00");
  });

  it("takes the earliest of several", () => {
    expect(
      slotWindow([
        instance({ start: "2026-01-12T08:00:00", end: "2026-01-12T09:00:00" }),
        instance({ start: "2026-01-13T05:15:00", end: "2026-01-13T06:00:00" }),
        instance({ start: "2026-01-14T11:00:00", end: "2026-01-14T12:00:00" }),
      ]).min
    ).toBe("05:00:00");
  });

  it("says nothing about the hours from an all-day event", () => {
    // It renders in its own row above the grid, so its 00:00 start is not a
    // claim that the day begins at midnight.
    expect(
      slotWindow([instance({ allDay: true, start: "2026-01-12", end: "2026-01-13" })]).min
    ).toBe("09:00:00");
  });

  it("extends past 11pm rather than clipping a late event", () => {
    expect(
      slotWindow([instance({ start: "2026-01-12T22:00:00", end: "2026-01-12T23:30:00" })]).max
    ).toBe("24:00:00");
  });

  it("reports a run past midnight as the end of the day", () => {
    // Hour zero would read as ending before it started and collapse the grid.
    expect(
      slotWindow([instance({ start: "2026-01-12T22:00:00", end: "2026-01-13T01:00:00" })]).max
    ).toBe("24:00:00");
  });

  it("keeps the default window for an empty week", () => {
    expect(slotWindow([])).toEqual({ min: "09:00:00", max: "23:00:00" });
  });
});

describe("WeekCalendar", () => {
  it("paints an event at the wall-clock time it was given", () => {
    render(<WeekCalendar events={[instance()]} {...PERIOD} now={NOW} onCycle={vi.fn()} />);

    // 2pm, whatever zone the machine running this is in. A grid doing its own
    // conversion would show 9am here under TZ=UTC.
    expect(screen.getByText("Afternoon thing")).toBeTruthy();
    expect(screen.getByText(/^2(:00)?p/i)).toBeTruthy();
  });

  it("renders the period's days, not the current week", () => {
    const { container } = render(
      <WeekCalendar events={[instance()]} {...PERIOD} now={NOW} onCycle={vi.fn()} />
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
      <WeekCalendar events={[]} periodStart="2026-01-15" periodEnd="2026-01-18" now={NOW} onCycle={vi.fn()} />
    );

    rerender(
      <WeekCalendar events={[]} periodStart="2026-01-19" periodEnd="2026-01-25" now={NOW} onCycle={vi.fn()} />
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
        now={NOW}
        onCycle={vi.fn()}
      />
    );

    expect(container.querySelectorAll(".fc-col-header-cell")).toHaveLength(4);
  });

  it("renders an early event rather than clipping it off the top", () => {
    // The point of the whole slot window: an event above the first visible hour
    // does not scroll — it simply is not there, which looks like data missing
    // rather than a grid cropped.
    const { container } = render(
      <WeekCalendar
        events={[
          instance({ title: "Early flight", start: "2026-01-12T06:00:00", end: "2026-01-12T07:30:00" }),
        ]}
        {...PERIOD}
        now={NOW}
        onCycle={vi.fn()}
      />
    );

    expect(screen.getByText("Early flight")).toBeTruthy();
    expect(container.querySelector(".fc-timegrid-body .fc-event")).toBeTruthy();
  });

  it("tightens the window when the early event is ignored", () => {
    // `slotMinTime` has to be reactive for this — unlike `initialDate`, which
    // is not, and which is why that one is pushed through the API instead.
    const early = instance({
      title: "Early flight",
      start: "2026-01-12T06:00:00",
      end: "2026-01-12T07:30:00",
    });
    const { container, rerender } = render(
      <WeekCalendar events={[early]} {...PERIOD} now={NOW} onCycle={vi.fn()} />
    );

    // Trimmed and compared whole: a bare /^6/ also matches 6pm, which is inside
    // the default window and would make this pass either way.
    const showsSixAm = () =>
      [...container.querySelectorAll(".fc-timegrid-slot-label")].some(
        (slot) => slot.textContent?.trim().toLowerCase() === "6am"
      );
    expect(showsSixAm()).toBe(true);

    rerender(
      <WeekCalendar events={[{ ...early, state: "hide" }]} {...PERIOD} now={NOW} onCycle={vi.fn()} />
    );

    expect(showsSixAm()).toBe(false);
  });

  it("marks today from the wall clock it was handed, not the machine's", () => {
    // The bug: FullCalendar left to find "now" itself reduces the machine clock
    // to UTC, because the grid is in UTC mode. At 8pm in New York — 01:00Z the
    // next day — it highlighted tomorrow's column.
    //
    // This assertion only means something across the TZ matrix: on a machine
    // already in New York, the wrong answer and the right one coincide.
    const { container } = render(
      <WeekCalendar events={[]} {...PERIOD} now="2026-01-14T20:00:00" onCycle={vi.fn()} />
    );

    const today = container.querySelector(".fc-col-header-cell.fc-day-today");
    expect(today?.textContent).toContain("1/14");
  });

  it("keeps an all-day event out of the timed grid", () => {
    const { container } = render(
      <WeekCalendar
        events={[
          instance({ title: "Whole day", allDay: true, start: "2026-01-14", end: "2026-01-15" }),
        ]}
        {...PERIOD}
        now={NOW}
        onCycle={vi.fn()}
      />
    );

    expect(screen.getByText("Whole day")).toBeTruthy();
    expect(container.querySelector(".fc-daygrid-body .fc-event")).toBeTruthy();
  });

  it("hands the clicked instance back to the caller", () => {
    const onCycle = vi.fn();
    const { container } = render(
      <WeekCalendar events={[instance()]} {...PERIOD} now={NOW} onCycle={onCycle} />
    );

    (container.querySelector(".fc-event") as HTMLElement | null)?.click();

    expect(onCycle).toHaveBeenCalledWith(expect.objectContaining({ uid: "evt@test" }));
  });
});

describe("toSunsetEvents", () => {
  it("makes a one-minute background event at the given time", () => {
    // A line is the shape wanted; a background event is the nearest thing
    // FullCalendar has, and a zero-length one is dropped rather than drawn.
    const [sunset] = toSunsetEvents(["2026-08-13T20:15:30"]);

    expect(sunset.start).toBe("2026-08-13T20:15:30");
    expect(sunset.end).toBe("2026-08-13T20:16:30");
    expect(sunset.display).toBe("background");
    expect(sunset.classNames).toEqual(["cal-sunset"]);
  });

  it("rolls the hour rather than inventing a 60th minute", () => {
    // The string-arithmetic version of this produced "20:60".
    expect(toSunsetEvents(["2026-08-13T20:59:00"])[0].end).toBe("2026-08-13T21:00:00");
  });

  it("skips days with no sunset", () => {
    // Above the Arctic circle in summer there is nothing to draw.
    expect(toSunsetEvents([])).toEqual([]);
  });
});

describe("slotWindow with a now-indicator", () => {
  it("keeps an early now in view", () => {
    // A line above the top of the grid isn't drawn at all, and 7am on a day with
    // nothing before 9 is a perfectly normal morning.
    expect(slotWindow([], "2026-01-12T07:20:00").min).toBe("07:00:00");
  });

  it("keeps a late now in view", () => {
    expect(slotWindow([], "2026-01-12T23:40:00").max).toBe("24:00:00");
  });

  it("changes nothing when now is inside the default window", () => {
    expect(slotWindow([], "2026-01-12T14:00:00")).toEqual({
      min: "09:00:00",
      max: "23:00:00",
    });
  });
});
