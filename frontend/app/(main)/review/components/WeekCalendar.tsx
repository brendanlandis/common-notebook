"use client";

import { useMemo } from "react";
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
  onCycle: (instance: ResolvedInstance) => void;
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

export default function WeekCalendar({
  events,
  periodStart,
  periodEnd,
  onCycle,
}: WeekCalendarProps) {
  const fcEvents = useMemo(() => toFullCalendarEvents(events), [events]);

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
        plugins={[timeGridPlugin]}
        initialView="timeGrid"
        timeZone="UTC"
        initialDate={periodStart}
        duration={{ days: dayCount }}
        events={fcEvents}
        // The review owns the period; letting the grid navigate away from it
        // would show a week the decisions aren't being made for.
        headerToolbar={false}
        allDaySlot
        nowIndicator={false}
        height="auto"
        expandRows
        slotMinTime="06:00:00"
        slotMaxTime="23:00:00"
        eventClick={(info) => {
          onCycle(info.event.extendedProps.instance as ResolvedInstance);
        }}
      />
    </div>
  );
}
