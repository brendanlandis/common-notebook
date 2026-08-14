import ICAL from 'ical.js';
import { Temporal } from 'temporal-polyfill';
import type { TimeZoneSettings } from '../timeZoneSettings';
import { trimIcs } from './trimIcs';

/**
 * ICS → event instances, resolved to the user's wall clock.
 *
 * This is the only place ical.js types exist. Everything downstream sees plain
 * wall-clock ISO strings in the owner's timezone, because that is what the week
 * grid paints and what the decision rows are keyed against.
 *
 * **Wall clock, not instants, is the output on purpose.** The renderer is driven
 * in UTC mode and handed these values, so it performs no timezone arithmetic of
 * its own and cannot be wrong across a DST weekend. Every zone decision in the
 * pipeline happens here, in Temporal.
 *
 * Two traps, both load-bearing:
 *
 * 1. **All-day events are `floating`** — they have no zone, and `toJSDate()` on
 *    one silently applies the *machine's* zone. On a UTC server serving a New
 *    York user that turns "14 January" into 13 January at 19:00. So all-day
 *    values are read as calendar components and never converted at all.
 * 2. **Timed events must go instant → Temporal → wall clock**, never through a
 *    Date's local getters. `toJSDate()` is a real instant, which is exactly what
 *    `Temporal.Instant.fromEpochMilliseconds` wants; the zone is named
 *    explicitly on the next line rather than inherited from the host.
 */

export interface CalendarEventInstance {
  /** ICS UID — stable across refeteches, which is what makes stored decisions survive a re-poll. */
  uid: string;
  /**
   * Which occurrence this is, as the ISO date-time of its start; null for a
   * non-recurring event. Together with `uid` this identifies one instance, and
   * a decision row with a null `recurrenceId` applies to the whole series.
   */
  recurrenceId: string | null;
  title: string;
  allDay: boolean;
  /** Wall clock in the owner's zone. `YYYY-MM-DDTHH:mm:ss`, or `YYYY-MM-DD` when all-day. */
  start: string;
  end: string;
}

/** A real instant, as wall-clock fields in the owner's zone. */
function wallClock(instant: Date, settings: TimeZoneSettings): string {
  const zoned = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(
    settings.timezone
  );
  return zoned.toPlainDateTime().toString({ smallestUnit: 'second' });
}

/** An ICAL.Time's calendar day, untouched — for values that have no zone to convert from. */
function plainDate(time: { year: number; month: number; day: number }): string {
  return Temporal.PlainDate.from({
    year: time.year,
    month: time.month,
    day: time.day,
  }).toString();
}

function render(
  time: ICAL.Time,
  settings: TimeZoneSettings
): { value: string; allDay: boolean } {
  return time.isDate
    ? { value: plainDate(time), allDay: true }
    : { value: wallClock(time.toJSDate(), settings), allDay: false };
}

/**
 * Every occurrence falling inside `[rangeStart, rangeEnd]` (inclusive ISO dates
 * in the owner's zone).
 *
 * Recurring events are expanded through ical.js's iterator, which applies
 * `EXDATE` and `UNTIL`/`COUNT` for us — the reason this doesn't go anywhere near
 * `lib/recurrence.ts`, whose fixed enum of task cadences is a far smaller
 * language than RRULE.
 *
 * A malformed feed yields an empty list rather than throwing: one calendar
 * failing to parse must not take down a review that has three others in it.
 */
export function expandIcs(
  icsText: string,
  rangeStart: string,
  rangeEnd: string,
  settings: TimeZoneSettings
): CalendarEventInstance[] {
  let components: ICAL.Component[];
  try {
    // Trimmed first, and here rather than at the call site so that no future
    // caller can forget it. A feed is the whole calendar — Google's ICS takes no
    // date range — so this is typically 93% of the input, and parsing it was
    // costing more than fetching it. `trimIcs` keeps everything whose absence
    // could change the answer and returns the input untouched if it doesn't
    // recognize the shape.
    components = new ICAL.Component(
      ICAL.parse(trimIcs(icsText, rangeStart, rangeEnd))
    ).getAllSubcomponents('vevent');
  } catch {
    return [];
  }

  // Split the series masters from the RECURRENCE-ID overrides, so an edited
  // single occurrence replaces the generated one rather than doubling it.
  const masters: ICAL.Event[] = [];
  const overrides: ICAL.Event[] = [];
  for (const component of components) {
    try {
      const event = new ICAL.Event(component);
      (event.isRecurrenceException() ? overrides : masters).push(event);
    } catch {
      // Skip an unparseable VEVENT rather than losing the whole calendar.
    }
  }
  for (const override of overrides) {
    const master = masters.find((m) => m.uid === override.uid);
    if (master) {
      try {
        master.relateException(override);
      } catch {
        // An override with no master is orphaned; it still renders on its own below.
      }
    }
  }

  const out: CalendarEventInstance[] = [];
  const inRange = (isoDay: string) => isoDay >= rangeStart && isoDay <= rangeEnd;

  /**
   * How far outside the window to keep walking a series, in case an occurrence
   * has been moved into it.
   *
   * A RECURRENCE-ID override can put an occurrence on a different day from the
   * slot it came from, in either direction, so the slot cannot decide whether
   * the event is in range — but it is still the only thing that can *bound* the
   * walk, since an unbounded RRULE has no last occurrence to stop at.
   *
   * A week each way covers dragging a rehearsal to the weekend, which is what
   * this is for. Something moved further than that is missed, which is the
   * deliberate trade for not resolving every occurrence of every series back to
   * 2019 — `getOccurrenceDetails` is the expensive call in this loop.
   */
  const OVERRIDE_GRACE_DAYS = 7;

  /** Plain-date arithmetic on a `YYYY-MM-DD`, so month ends behave. */
  const shiftDay = (isoDay: string, days: number) =>
    Temporal.PlainDate.from(isoDay).add({ days }).toString();

  for (const event of masters) {
    if (!event.isRecurring()) {
      const start = render(event.startDate, settings);
      if (!inRange(start.value.slice(0, 10))) continue;
      out.push({
        uid: event.uid,
        recurrenceId: null,
        title: event.summary ?? '',
        allDay: start.allDay,
        start: start.value,
        end: render(event.endDate, settings).value,
      });
      continue;
    }

    const iterator = event.iterator();
    let occurrence: ICAL.Time | null;
    // A bounded walk: an unbounded RRULE would otherwise iterate forever if the
    // range check never fires. 800 covers a daily event over two years, which is
    // far more than any window this feature asks for.
    let guard = 0;
    while ((occurrence = iterator.next()) && guard++ < 800) {
      // Where the *series* puts this occurrence, before any override moves it.
      // Used only to bound the walk — never to decide whether the event is in
      // range, which is a different question once an occurrence can move.
      const slotDay = render(occurrence, settings).value.slice(0, 10);
      if (slotDay > shiftDay(rangeEnd, OVERRIDE_GRACE_DAYS)) break;
      // Skipping the far-past ones cheaply matters: `getOccurrenceDetails` is
      // the expensive call, and a weekly series from 2019 has ~370 occurrences
      // before it reaches this week.
      if (slotDay < shiftDay(rangeStart, -OVERRIDE_GRACE_DAYS)) continue;

      // `getOccurrenceDetails` folds in any RECURRENCE-ID override, so an edited
      // instance reports its own moved time and title rather than the series'.
      const details = event.getOccurrenceDetails(occurrence);
      const start = render(details.startDate, settings);
      // Range-tested on where the occurrence *actually is*, not on the slot it
      // came from. A rehearsal that recurs on Sundays but was dragged to the
      // Saturday sits on Saturday, and asking the series where it belongs got
      // the answer "Sunday" — so it was excluded from a window ending Saturday,
      // and, because that test was a `break`, so was everything after it.
      if (!inRange(start.value.slice(0, 10))) continue;
      out.push({
        uid: event.uid,
        recurrenceId: occurrence.toString(),
        title: details.item.summary ?? event.summary ?? '',
        allDay: start.allDay,
        start: start.value,
        end: render(details.endDate, settings).value,
      });
    }
  }

  // Orphaned overrides — an exception whose master isn't in the feed.
  for (const override of overrides) {
    if (masters.some((m) => m.uid === override.uid)) continue;
    const start = render(override.startDate, settings);
    if (!inRange(start.value.slice(0, 10))) continue;
    out.push({
      uid: override.uid,
      recurrenceId: override.recurrenceId?.toString() ?? null,
      title: override.summary ?? '',
      allDay: start.allDay,
      start: start.value,
      end: render(override.endDate, settings).value,
    });
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}
