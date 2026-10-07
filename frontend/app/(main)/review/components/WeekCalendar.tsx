"use client";

import { useEffect, useMemo, useRef } from "react";
import FullCalendar, { type CalendarRef } from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import classicTheme from "@fullcalendar/react/themes/classic";
import { Temporal } from "temporal-polyfill";
import type { ResolvedInstance } from "@/app/lib/ics/resolveDecisions";
import "@/app/css/fullcalendar.css";

/**
 * The week's calendar, as a decision surface.
 *
 * ## Why `timeZone: "UTC"` when the user is not in UTC
 *
 * This is the single most important line in the file, and it looks wrong.
 *
 * The events handed in have already been resolved to the owner's **wall clock**
 * by `expandIcs`, using Temporal and the owner's configured zone — `start` is a
 * string like `2026-01-12T14:00:00` meaning "2pm where this person lives", with
 * no offset attached. Telling FullCalendar those values are UTC makes it paint
 * exactly those numbers and perform no timezone arithmetic of its own.
 *
 * The alternative — `timeZone: "local"` — would render in the *browser's* zone,
 * which is not necessarily the owner's configured one. That is precisely the
 * bug class this codebase has shipped three times and now has a CI-gated test
 * against: correct on a laptop whose zone matches the setting, wrong in
 * production. FullCalendar 7 can take a named zone itself, but these values have
 * already been through one zone conversion, and a second would be wrong.
 *
 * So: every zone decision happens in Temporal, upstream. This component paints.
 */

interface WeekCalendarProps {
  events: ResolvedInstance[];
  /** Inclusive ISO dates. */
  periodStart: string;
  periodEnd: string;
  /**
   * The owner's current wall clock, `YYYY-MM-DDTHH:mm:ss` — same convention as
   * the events. Decides which column is highlighted as today.
   */
  now: string;
  /**
   * Wall-clock sunset per day, `YYYY-MM-DDTHH:mm:ss` each. Drawn as a line
   * across the grid — the daily page's answer to "how much of today is left",
   * which the light tells you better than the clock does.
   */
  sunsets?: string[];
  /** Draw the line marking the current time. Off on the review, on for today. */
  showNow?: boolean;
  /**
   * The events have just turned up, so fade them in — see `useArrival` for why
   * this is a window rather than a standing rule, and `.is-arriving` for what it
   * does.
   */
  arriving?: boolean;
  /**
   * The hour the user's day turns over. Given, the grid runs past midnight to
   * `boundary + 24` — which only the daily view wants; the week stops at
   * midnight.
   */
  boundaryHour?: number;
  /**
   * Omitted where the grid is for reading rather than deciding.
   *
   * Handed the clicked element as well as the instance, because a decision that
   * takes the event off the grid has to fade it out first, and only the DOM node
   * can be faded — see `leaveThenUpdate`.
   */
  onCycle?: (instance: ResolvedInstance, element: HTMLElement) => void;
}

const STATE_CLASS: Record<string, string> = {
  show: "cal-event-show",
  hide: "cal-event-hide",
  unset: "cal-event-unset",
};

/**
 * Resolved instances → the objects FullCalendar consumes.
 *
 * Exported and pure so the mapping this codebase owns can be asserted directly:
 * that the wall-clock strings are handed over untouched, and that each state
 * gets its own class.
 */
export function toFullCalendarEvents(events: ResolvedInstance[]) {
  return events.map((instance, i) => ({
    // uid+recurrenceId identifies an occurrence, but a feed can legitimately
    // repeat a uid across calendars; the index keeps keys unique without
    // pretending the pair is globally unique.
    id: `${instance.calendarDocumentId}:${instance.uid}:${instance.recurrenceId ?? ""}:${i}`,
    title: instance.title || "(no title)",
    // Passed through verbatim. These are already wall clock in the owner's
    // zone; any conversion here would be the second one and therefore wrong.
    start: instance.start,
    end: instance.end,
    allDay: instance.allDay,
    className: STATE_CLASS[instance.state] ?? "cal-event-unset",
    extendedProps: { instance },
  }));
}

// Read in UTC, like everything else this grid is handed: wall clock labeled UTC.
const HEADER_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

/** A column's heading: "Tue 10/6". */
export function dayHeaderText(date: Date): string {
  return HEADER_FORMAT.format(date).replace(",", "");
}

/** Where a day is normally read from, when nothing earlier demands otherwise. */
const DEFAULT_FIRST_HOUR = 9;

const asSlot = (hour: number) => `${String(hour).padStart(2, "0")}:00:00`;

/**
 * The band of hours a day column shows.
 *
 * ## Where the day ends
 *
 * Midnight, unless a `boundaryHour` is given — and only the daily grid gives
 * one. There, a day ends where the rest of the app says it ends (the user's
 * `dayBoundaryHour`), so the column runs to `boundary + 24`: `27:00:00` for a
 * 3am boundary. FullCalendar supports slot times beyond 24 hours precisely for
 * this and renders the small hours of the *following* date in the current
 * column, so a gig ending at 1am sits at the bottom of the night it belongs to
 * rather than at the top of the next morning — which is what every other surface
 * in this app already believes about 1am.
 *
 * The week grid doesn't do that. Seven columns each running three hours into the
 * next is a lot of mostly-empty grid to carry for the sake of the occasional
 * late night, and the week is read for its shape rather than its edges.
 *
 * **The window must never exceed 24 hours**, and that's the one real hazard of
 * the extended form. Let `min` fall below `max - 24` and a 1am event renders
 * twice: once in its own column at 01:00 and again in the previous column at
 * 25:00. Hence the clamp to the boundary below.
 *
 * ## It starts at 9am, unless
 *
 * Eight empty rows above the first event are eight rows of nothing. It opens
 * earlier when something is actually up there — so the window is decided by the
 * day rather than fixed in advance, and an early meeting can't fall off the top
 * where it would be invisible rather than merely undecided. Never earlier than
 * the boundary, per above.
 *
 * **Ignored events don't count.** Deciding an event is fake is exactly the
 * statement that it shouldn't stretch your picture of the day; only real and
 * undecided ones widen the window. So the grid tightens up as a review is worked
 * through, which is the intended feel.
 *
 * Exported and pure so the rule can be asserted without a rendered grid.
 */
export interface SlotWindowOptions {
  /**
   * The hour the user's day turns over. Given, the grid runs to `boundary + 24`
   * and never opens before the boundary; omitted, a day ends at midnight.
   */
  boundaryHour?: number;
  /**
   * Kept in view where the grid draws a now-indicator — a line above the top of
   * the grid isn't drawn at all, and an empty morning is a normal morning.
   */
  now?: string;
}

export function slotWindow(
  events: ResolvedInstance[],
  { boundaryHour, now }: SlotWindowOptions = {}
): { min: string; max: string } {
  const extended = boundaryHour !== undefined && Number.isFinite(boundaryHour);
  const boundary = extended
    ? Math.min(23, Math.max(0, Math.trunc(boundaryHour as number)))
    : 0;
  let first = DEFAULT_FIRST_HOUR;

  const openTo = (value: string) => {
    const hour = Number(value.slice(11, 13));
    if (Number.isFinite(hour)) first = Math.min(first, hour);
  };

  if (now) openTo(now);

  for (const event of events) {
    // All-day events live in their own row above the grid, so they say nothing
    // about which hours to show.
    if (event.allDay || event.state === "hide") continue;
    openTo(event.start);
  }

  return {
    // Never before the boundary, or the column would overlap the one before it
    // and render the small hours twice.
    min: asSlot(Math.max(boundary, Math.min(first, DEFAULT_FIRST_HOUR))),
    max: asSlot(boundary + 24),
  };
}

/**
 * Sunsets → hairline background events.
 *
 * FullCalendar has no concept of "draw a line at this time", and its own
 * `nowIndicator` is the only built-in of that shape. A background event one
 * minute long is the nearest thing that exists: it lands in the right column at
 * the right height, scrolls and rescales with the grid for free, and is styled
 * down to a line in CSS. Zero-length events are dropped rather than drawn, hence
 * the minute.
 */
export function toSunsetEvents(sunsets: string[]) {
  return sunsets.filter(Boolean).map((sunset) => ({
    id: `sunset:${sunset}`,
    title: "sunset",
    start: sunset,
    // Temporal rather than string arithmetic: a sunset at 20:59 would otherwise
    // end at 20:60.
    end: Temporal.PlainDateTime.from(sunset).add({ minutes: 1 }).toString(),
    allDay: false,
    display: "background" as const,
    className: "cal-sunset",
    extendedProps: {},
  }));
}

export default function WeekCalendar({
  events,
  periodStart,
  periodEnd,
  now,
  sunsets = [],
  showNow = false,
  arriving = false,
  boundaryHour,
  onCycle,
}: WeekCalendarProps) {
  const fcEvents = useMemo(
    () => [...toFullCalendarEvents(events), ...toSunsetEvents(sunsets)],
    [events, sunsets]
  );
  const slots = useMemo(
    () => slotWindow(events, { boundaryHour, now: showNow ? now : undefined }),
    [events, boundaryHour, showNow, now]
  );
  const calendarRef = useRef<CalendarRef | null>(null);

  /**
   * Move the grid when the period moves.
   *
   * `initialDate` is exactly what it says — read once, at mount, and ignored on
   * every later render. `duration` *is* reactive, and that mismatch is a live
   * bug rather than a theoretical one: switching from "the rest of this one"
   * (Thu–Sun, 4 days) to "the cycle ahead" (Mon–Sun, 7 days) grew the grid to
   * seven days while leaving it anchored on today, so it showed *the next seven
   * days* instead of the next week. The remount that would have hidden this only
   * happens the first time each period is loaded; come back to one already in
   * the query cache and the component never unmounts.
   *
   * So the anchor is pushed imperatively. `gotoDate` on mount is a no-op, since
   * `initialDate` has already put it there.
   */
  useEffect(() => {
    calendarRef.current?.getApi().gotoDate(periodStart);
  }, [periodStart]);

  // Anchor the view on the period explicitly. `visibleRange` alone does not
  // move a generic timeGrid view off today — the grid renders, the events fall
  // outside it, and nothing appears at all, which looks like a data problem
  // rather than a configuration one.
  const dayCount = useMemo(
    () =>
      Temporal.PlainDate.from(periodStart).until(Temporal.PlainDate.from(periodEnd)).days + 1,
    [periodStart, periodEnd]
  );

  return (
    /* `is-readonly` where there's nothing to click. The daily grid is for
       reading — it has no `onCycle` — so its events must not look like
       controls; only the review page's get a pointer. */
    <div
      className={`text-tiny review-calendar${arriving ? " is-arriving" : ""}${
        onCycle ? "" : " is-readonly"
      }`}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, classicTheme]}
        // FullCalendar 7 puts no stable class on anything (its own are hashed),
        // so these name the parts `review-calendar.css` and the tests reach for.
        dayHeaderClass={(info) => (info.isToday ? "cal-day-header is-today" : "cal-day-header")}
        // Our own text, at every width. FullCalendar cuts a header to one letter
        // in a column under 60px (T W T F S S, no dates), which is every column
        // of a week on a phone, and "Tue 10/6" wraps onto two lines fine there.
        dayHeaderContent={(info) => dayHeaderText(info.date)}
        // Nor the narrow form of the rest (smaller event text, under 80px).
        dayNarrowWidth={0}
        dayLaneClass={(info) => (info.isToday ? "cal-day-lane is-today" : "cal-day-lane")}
        dayCellClass={(info) => (info.isToday ? "cal-all-day-cell is-today" : "cal-all-day-cell")}
        slotHeaderClass="cal-slot-header"
        slotHeaderInnerClass="cal-slot-label"
        allDayHeaderInnerClass="cal-slot-label"
        // Lowercase, as every label in the app is; v7 capitalizes its own.
        allDayText="all-day"
        backgroundEventTitleClass="cal-background-title"
        eventClass={(info) => (info.event.allDay ? "cal-event is-all-day" : "cal-event")}
        eventTimeClass="cal-event-time"
        eventTitleClass="cal-event-title"
        // The daily page measures this to line its list up with the time.
        nowIndicatorLineClass="cal-now-line"
        initialView="timeGrid"
        timeZone="UTC"
        /**
         * "Today" in the owner's zone, not the browser's and not UTC.
         *
         * Everything else here is wall clock labeled UTC, and `now` has to
         * follow the same convention or it isn't comparable to the columns.
         * Left to default it, FullCalendar reads the machine clock and reduces
         * it to UTC — so at 8pm in New York, 01:00Z the next day, it highlighted
         * tomorrow's column.
         */
        now={now}
        initialDate={periodStart}
        duration={{ days: dayCount }}
        events={fcEvents}
        // The review owns the period; letting the grid navigate away from it
        // would show a week the decisions aren't being made for.
        headerToolbar={false}
        allDaySlot
        nowIndicator={showNow}
        height="auto"
        expandRows
        slotMinTime={slots.min}
        slotMaxTime={slots.max}
        // Only where a click decides something: given an `eventClick`,
        // FullCalendar makes every event a button, which the daily grid's aren't.
        eventClick={
          onCycle
            ? (info) => {
                const instance = info.event.extendedProps.instance as ResolvedInstance | undefined;
                // Background events (the sunset line) carry no instance.
                if (instance) onCycle(instance, info.el);
              }
            : undefined
        }
      />
    </div>
  );
}
