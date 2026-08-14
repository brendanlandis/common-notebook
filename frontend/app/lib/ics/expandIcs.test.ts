import { describe, it, expect } from 'vitest';
import { expandIcs } from './expandIcs';
import type { TimeZoneSettings } from '../timeZoneSettings';

/**
 * The ICS → wall-clock boundary.
 *
 * Run across the TZ matrix, and that is the entire point: every assertion here
 * is a wall-clock value derived from an instant, so a suite that only ever ran
 * on a machine whose zone matches the user's would prove nothing. The all-day
 * cases in particular pass trivially on a UTC machine and fail on a real one if
 * the conversion is wrong — which is the exact shape of the bug this codebase
 * has shipped three times.
 */

const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };
const KOLKATA: TimeZoneSettings = { timezone: 'Asia/Kolkata', dayBoundaryHour: 4 };

const ics = (...events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:DAYLIGHT',
    'DTSTART:20070311T020000',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'DTSTART:20071104T020000',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

const event = (lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

describe('expandIcs', () => {
  it('renders a timed event in the owner’s zone, not the machine’s', () => {
    // 14:00 New York. On a UTC host this is 19:00Z; reading it back as UTC would
    // put the event at 7pm on the grid.
    const feed = ics(
      event([
        'UID:timed@test',
        'DTSTART;TZID=America/New_York:20260112T140000',
        'DTEND;TZID=America/New_York:20260112T150000',
        'SUMMARY:Standup',
      ])
    );

    const [instance] = expandIcs(feed, '2026-01-12', '2026-01-18', EST);

    expect(instance).toMatchObject({
      uid: 'timed@test',
      title: 'Standup',
      allDay: false,
      start: '2026-01-12T14:00:00',
      end: '2026-01-12T15:00:00',
    });
  });

  it('re-times the same event for a different owner zone', () => {
    // The same instant, seen from Kolkata: 14:00 EST is 00:30 the next day.
    const feed = ics(
      event([
        'UID:timed@test',
        'DTSTART;TZID=America/New_York:20260112T140000',
        'DTEND;TZID=America/New_York:20260112T150000',
        'SUMMARY:Standup',
      ])
    );

    const [instance] = expandIcs(feed, '2026-01-12', '2026-01-18', KOLKATA);

    expect(instance.start).toBe('2026-01-13T00:30:00');
  });

  it('keeps an all-day event on its own date', () => {
    // The trap: all-day values are floating, and toJSDate() on one applies the
    // *machine's* zone. On a UTC host serving a New York user that turns 14
    // January into 13 January at 19:00.
    const feed = ics(
      event([
        'UID:allday@test',
        'DTSTART;VALUE=DATE:20260114',
        'DTEND;VALUE=DATE:20260115',
        'SUMMARY:A whole day',
      ])
    );

    const [instance] = expandIcs(feed, '2026-01-12', '2026-01-18', EST);

    expect(instance).toMatchObject({
      allDay: true,
      start: '2026-01-14',
      end: '2026-01-15',
    });
  });

  it('gives an all-day event the same date in every zone', () => {
    const feed = ics(
      event(['UID:allday@test', 'DTSTART;VALUE=DATE:20260114', 'DTEND;VALUE=DATE:20260115'])
    );

    for (const settings of [EST, KOLKATA]) {
      const [instance] = expandIcs(feed, '2026-01-12', '2026-01-18', settings);
      expect(instance.start, settings.timezone).toBe('2026-01-14');
    }
  });

  it('expands a weekly recurrence within the range only', () => {
    const feed = ics(
      event([
        'UID:weekly@test',
        'DTSTART;TZID=America/New_York:20260105T090000',
        'DTEND;TZID=America/New_York:20260105T093000',
        'RRULE:FREQ=WEEKLY;COUNT=10',
        'SUMMARY:Weekly thing',
      ])
    );

    const instances = expandIcs(feed, '2026-01-12', '2026-01-18', EST);

    expect(instances).toHaveLength(1);
    expect(instances[0].start).toBe('2026-01-12T09:00:00');
    // The occurrence is identified, so a decision can be stored against it.
    expect(instances[0].recurrenceId).not.toBeNull();
  });

  it('finds an occurrence moved BACKWARD into the window, past the series slot', () => {
    // The bug this is here for. A rehearsal recurs on Sundays; this week's was
    // dragged to the Saturday. The window ends on that Saturday.
    //
    // The range test used to run on the *series slot* — Sunday — so the event
    // was judged out of range and, because that test was a `break` rather than a
    // `continue`, every later occurrence went with it. On the daily page, which
    // asks for exactly today..tomorrow, tomorrow's moved rehearsal vanished
    // while the same event showed up fine on the review page, whose window
    // happened to run a day further.
    const feed = ics(
      event([
        'UID:moved@test',
        'DTSTART;TZID=America/New_York:20260719T113000',
        'DTEND;TZID=America/New_York:20260719T133000',
        'RRULE:FREQ=WEEKLY;BYDAY=SU',
        'SUMMARY:Receive',
      ]),
      event([
        'UID:moved@test',
        'RECURRENCE-ID;TZID=America/New_York:20260816T113000',
        'DTSTART;TZID=America/New_York:20260815T163000',
        'DTEND;TZID=America/New_York:20260815T183000',
        'SUMMARY:Receive',
      ])
    );

    const instances = expandIcs(feed, '2026-08-14', '2026-08-15', EST);

    expect(instances.map((i) => i.start)).toContain('2026-08-15T16:30:00');
  });

  it('leaves out an occurrence moved OUT of the window', () => {
    // The other direction, and the reason the test moved onto the resolved start
    // rather than simply widening the window: the slot is inside the range and
    // the event is not.
    const feed = ics(
      event([
        'UID:movedout@test',
        'DTSTART;TZID=America/New_York:20260719T113000',
        'DTEND;TZID=America/New_York:20260719T133000',
        'RRULE:FREQ=WEEKLY;BYDAY=SU',
        'SUMMARY:Receive',
      ]),
      event([
        'UID:movedout@test',
        'RECURRENCE-ID;TZID=America/New_York:20260816T113000',
        'DTSTART;TZID=America/New_York:20260820T163000',
        'DTEND;TZID=America/New_York:20260820T183000',
        'SUMMARY:Receive',
      ])
    );

    const instances = expandIcs(feed, '2026-08-16', '2026-08-16', EST);

    expect(instances).toHaveLength(0);
  });

  it('honors EXDATE', () => {
    const feed = ics(
      event([
        'UID:skipped@test',
        'DTSTART;TZID=America/New_York:20260105T090000',
        'DTEND;TZID=America/New_York:20260105T093000',
        'RRULE:FREQ=WEEKLY;COUNT=10',
        'EXDATE;TZID=America/New_York:20260112T090000',
        'SUMMARY:Skips one',
      ])
    );

    expect(expandIcs(feed, '2026-01-12', '2026-01-18', EST)).toEqual([]);
  });

  it('lets a RECURRENCE-ID override replace its generated occurrence', () => {
    // The moved instance must appear once, at its new time — not twice, and not
    // at the series time.
    const feed = ics(
      event([
        'UID:moved@test',
        'DTSTART;TZID=America/New_York:20260105T090000',
        'DTEND;TZID=America/New_York:20260105T093000',
        'RRULE:FREQ=WEEKLY;COUNT=10',
        'SUMMARY:Series',
      ]),
      event([
        'UID:moved@test',
        'RECURRENCE-ID;TZID=America/New_York:20260112T090000',
        'DTSTART;TZID=America/New_York:20260112T160000',
        'DTEND;TZID=America/New_York:20260112T163000',
        'SUMMARY:Moved later',
      ])
    );

    const instances = expandIcs(feed, '2026-01-12', '2026-01-18', EST);

    expect(instances).toHaveLength(1);
    expect(instances[0].start).toBe('2026-01-12T16:00:00');
    expect(instances[0].title).toBe('Moved later');
  });

  it('survives a DST transition without shifting the wall clock', () => {
    // US DST begins 8 March 2026. A 09:00 weekly event stays at 09:00 either
    // side of it — the instant moves by an hour, the wall clock does not. A
    // fixed UTC offset would slide one of these to 08:00 or 10:00.
    const feed = ics(
      event([
        'UID:dst@test',
        'DTSTART;TZID=America/New_York:20260302T090000',
        'DTEND;TZID=America/New_York:20260302T093000',
        'RRULE:FREQ=WEEKLY;COUNT=4',
        'SUMMARY:Across the change',
      ])
    );

    const instances = expandIcs(feed, '2026-03-02', '2026-03-16', EST);

    expect(instances.map((i) => i.start)).toEqual([
      '2026-03-02T09:00:00',
      '2026-03-09T09:00:00', // the day after the change
      '2026-03-16T09:00:00',
    ]);
  });

  it('returns nothing for a malformed feed rather than throwing', () => {
    // One bad calendar must not take down a review that has three good ones.
    expect(expandIcs('this is not a calendar', '2026-01-12', '2026-01-18', EST)).toEqual([]);
  });

  it('sorts by start time', () => {
    const feed = ics(
      event([
        'UID:late@test',
        'DTSTART;TZID=America/New_York:20260112T160000',
        'DTEND;TZID=America/New_York:20260112T170000',
      ]),
      event([
        'UID:early@test',
        'DTSTART;TZID=America/New_York:20260112T090000',
        'DTEND;TZID=America/New_York:20260112T100000',
      ])
    );

    expect(expandIcs(feed, '2026-01-12', '2026-01-18', EST).map((i) => i.uid)).toEqual([
      'early@test',
      'late@test',
    ]);
  });
});
