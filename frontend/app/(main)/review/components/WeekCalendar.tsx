"use client";

import { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Temporal } from "temporal-polyfill";
import type { ResolvedInstance } from "@/app/lib/ics/resolveDecisions";

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
 * production. FullCalendar's own named-zone support needs a luxon or moment
 * plugin, i.e. a second date library, which is what we are avoiding.
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
  /** Omitted where the grid is for reading rather than deciding. */
  onCycle?: (instance: ResolvedInstance) => void;
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
    classNames: [STATE_CLASS[instance.state] ?? "cal-event-unset"],
    extendedProps: { instance },
  }));
}

/** The default working window — the hours a week is normally read in. */
const DEFAULT_FIRST_HOUR = 9;
const DEFAULT_LAST_HOUR = 23;

const asSlot = (hour: number) => `${String(hour).padStart(2, "0")}:00:00`;

/**
 * The band of hours the grid shows.
 *
 * Starts at 9am, because that is where a week is normally read from and eight
 * empty rows above the first event are eight rows of nothing. It opens earlier
 * only when something is actually up there — so the window is decided by the
 * week rather than fixed in advance, and an early meeting can't fall off the top
 * of the grid where it would be invisible rather than merely undecided.
 *
 * **Ignored events don't count.** Deciding to ignore the 6am thing is exactly
 * the statement that it shouldn't stretch your picture of the day; only kept and
 * undecided events widen the window. Which means the grid tightens up as a
 * review is worked through, and that's the intended feel.
 *
 * The same rule runs at the bottom, for the same reason: an event ending after
 * 11pm would otherwise be silently clipped.
 *
 * Exported and pure so the rule can be asserted without a rendered grid.
 */
export function slotWindow(
  events: ResolvedInstance[],
  /** Kept in view where the grid draws a now-indicator — a line above the top
   *  of the grid isn't drawn at all, and an empty morning is a normal morning. */
  now?: string
): { min: string; max: string } {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;

  if (now) {
    const nowHour = Number(now.slice(11, 13));
    if (Number.isFinite(nowHour)) {
      first = Math.min(first, nowHour);
      last = Math.max(last, Math.min(24, nowHour + 1));
    }
  }

  for (const event of events) {
    // All-day events live in their own row above the grid, so they say nothing
    // about which hours to show.
    if (event.allDay || event.state === "hide") continue;

    const startHour = Number(event.start.slice(11, 13));
    if (Number.isFinite(startHour)) first = Math.min(first, startHour);

    // A run past midnight is reported as the end of the day rather than as hour
    // zero, which would read as "ends before it starts" and collapse the grid.
    const crossesMidnight = event.end.slice(0, 10) !== event.start.slice(0, 10);
    const endHour = Number(event.end.slice(11, 13));
    const endMinute = Number(event.end.slice(14, 16));
    if (crossesMidnight) last = 24;
    else if (Number.isFinite(endHour)) {
      last = Math.max(last, endMinute > 0 ? endHour + 1 : endHour);
    }
  }

  return {
    min: asSlot(Math.max(0, Math.min(first, DEFAULT_FIRST_HOUR))),
    max: asSlot(Math.min(24, last)),
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
    classNames: ["cal-sunset"],
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
  onCycle,
}: WeekCalendarProps) {
  const fcEvents = useMemo(
    () => [...toFullCalendarEvents(events), ...toSunsetEvents(sunsets)],
    [events, sunsets]
  );
  const slots = useMemo(
    () => slotWindow(events, showNow ? now : undefined),
    [events, showNow, now]
  );
  const calendarRef = useRef<FullCalendar | null>(null);

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
    <div className="review-calendar">
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin]}
        initialView="timeGrid"
        timeZone="UTC"
        /**
         * "Today" in the owner's zone, not the browser's and not UTC.
         *
         * Everything else here is wall clock labelled UTC, and `now` has to
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
        eventClick={(info) => {
          const instance = info.event.extendedProps.instance as ResolvedInstance | undefined;
          // Background events (the sunset line) carry no instance, and a grid
          // with no `onCycle` is for reading.
          if (instance) onCycle?.(instance);
        }}
      />
    </div>
  );
}
