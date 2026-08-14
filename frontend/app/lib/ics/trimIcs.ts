import { Temporal } from 'temporal-polyfill';

/**
 * Throw away the VEVENTs that cannot possibly fall in the window, before ical.js
 * has to parse them.
 *
 * ## Why this exists
 *
 * Google's secret-address ICS exports the **entire calendar** and takes no
 * date-range parameter — there is no documented query string for one, and the
 * measurements bear it out: this account's five feeds are 1.37MB and 4,195
 * VEVENTs, the largest going back to 2011, to answer a question about seven days
 * that has 18 events in it. Parsing all of that cost ~1.5s per request, which was
 * *more* than the ~1.0s spent fetching it.
 *
 * 3,910 of those 4,195 (93%) are one-off events that ended years ago. They can be
 * dropped with a line scan, which is orders of magnitude cheaper than building
 * an object graph for each one.
 *
 * ## What is never dropped
 *
 * Anything whose absence could change the answer:
 *
 * - **Recurring masters** (`RRULE`/`RDATE`). A weekly standup created in 2019 is
 *   a 2019 event that occurs this Tuesday.
 * - **`RECURRENCE-ID` overrides**, whatever their date. An override is how a
 *   series says "that one occurrence moved" — drop it and `expandIcs` would
 *   generate the occurrence at its *original* time, resurrecting an event that
 *   was moved or deleted. Rare enough to keep unconditionally rather than reason
 *   about.
 * - **Anything outside a VEVENT** — the VCALENDAR envelope and every VTIMEZONE,
 *   which the remaining events' `TZID`s point at.
 * - **Anything unparseable.** No `DTSTART` this can read means the event is kept.
 *
 * ## Why a line scan rather than a parse
 *
 * Parsing is the cost being avoided, so this cannot parse. It works on physical
 * lines and only ever looks at *unfolded* property names — a continuation line in
 * ICS begins with a space or a tab, so a `DESCRIPTION` containing the text
 * "BEGIN:VEVENT" is indented and cannot be mistaken for the real thing. Dates are
 * compared as the `YYYYMMDD` they are already written in, which sidesteps every
 * question of zone and of `VALUE=DATE` versus a UTC stamp; the window is padded
 * by two days on each side so that no amount of zone offset can push a wanted
 * event over the edge.
 *
 * Anything it doesn't understand — unbalanced `BEGIN`/`END`, a window it can't
 * read — returns the input untouched. The optimisation is worth having and not
 * worth being clever about: a wrong answer here is a missing event on someone's
 * calendar.
 */

/** Two days, because a UTC stamp can be a day off the owner's calendar day. */
const PADDING_DAYS = 2;

const asStamp = (isoDate: string) => isoDate.replace(/-/g, '');

/** The first `YYYYMMDD` after a colon — covers `:20260813`, `;TZID=…:20260813T…`. */
const stampOf = (line: string): string | null => line.match(/:(\d{8})/)?.[1] ?? null;

/** A property line, as opposed to a folded continuation of the one above. */
const isFolded = (line: string) => line.startsWith(' ') || line.startsWith('\t');

const startsWith = (line: string, name: string) =>
  !isFolded(line) &&
  line.startsWith(name) &&
  // `DTSTART:` and `DTSTART;TZID=…` are the property; `DTSTAMP` is not.
  (line[name.length] === ':' || line[name.length] === ';');

export function trimIcs(icsText: string, rangeStart: string, rangeEnd: string): string {
  let from: string;
  let to: string;
  try {
    from = asStamp(
      Temporal.PlainDate.from(rangeStart).subtract({ days: PADDING_DAYS }).toString()
    );
    to = asStamp(Temporal.PlainDate.from(rangeEnd).add({ days: PADDING_DAYS }).toString());
  } catch {
    return icsText;
  }

  const newline = icsText.includes('\r\n') ? '\r\n' : '\n';
  const lines = icsText.split(/\r?\n/);

  const kept: string[] = [];
  let block: string[] | null = null;

  for (const line of lines) {
    if (!isFolded(line) && line.trimEnd() === 'BEGIN:VEVENT') {
      // A nested or unterminated VEVENT is not something this understands.
      if (block) return icsText;
      block = [line];
      continue;
    }

    if (!block) {
      kept.push(line);
      continue;
    }

    block.push(line);
    if (isFolded(line) || line.trimEnd() !== 'END:VEVENT') continue;

    if (keepEvent(block, from, to)) kept.push(...block);
    block = null;
  }

  // Ran out of lines mid-event: the feed is not shaped the way this assumes.
  if (block) return icsText;

  return kept.join(newline);
}

function keepEvent(block: string[], from: string, to: string): boolean {
  let start: string | null = null;
  let end: string | null = null;

  for (const line of block) {
    if (startsWith(line, 'RRULE') || startsWith(line, 'RDATE')) return true;
    if (startsWith(line, 'RECURRENCE-ID')) return true;
    if (startsWith(line, 'DTSTART')) start = stampOf(line);
    else if (startsWith(line, 'DTEND')) end = stampOf(line);
  }

  // Nothing readable to judge it by.
  if (!start) return true;

  // An event with no DTEND is a point in time at DTSTART.
  return (end ?? start) >= from && start <= to;
}
