import { describe, it, expect } from 'vitest';
import { trimIcs } from './trimIcs';
import { expandIcs } from './expandIcs';
import type { TimeZoneSettings } from '../timeZoneSettings';

/**
 * Dropping the 93% of a calendar feed that cannot be in the window.
 *
 * The whole value of this is speed, and the whole risk is a missing event on
 * someone's calendar — so most of what's below is about what it must *not* drop.
 * The last test is the one that matters most: trimming then expanding must give
 * exactly what expanding alone gives.
 */

const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

const ics = (...events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

const event = (lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

const uids = (text: string) =>
  [...text.matchAll(/^UID:(.+)$/gm)].map((match) => match[1].trim());

describe('trimIcs', () => {
  it('drops a one-off that ended before the window', () => {
    const text = ics(
      event(['UID:ancient@test', 'SUMMARY:2011', 'DTSTART:20110704T120000Z', 'DTEND:20110704T130000Z']),
      event(['UID:now@test', 'SUMMARY:this week', 'DTSTART:20260813T120000Z', 'DTEND:20260813T130000Z'])
    );

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual(['now@test']);
  });

  it('drops a one-off that starts after the window', () => {
    const text = ics(
      event(['UID:later@test', 'DTSTART:20271201T120000Z', 'DTEND:20271201T130000Z'])
    );

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual([]);
  });

  it('keeps a recurring master however old it is', () => {
    // The single most important case: a standup created in 2019 is a 2019 event
    // that happens this Tuesday.
    const text = ics(
      event([
        'UID:standup@test',
        'DTSTART;TZID=America/New_York:20190107T090000',
        'DTEND;TZID=America/New_York:20190107T091500',
        'RRULE:FREQ=WEEKLY;BYDAY=TU',
      ])
    );

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual(['standup@test']);
  });

  it('keeps an RDATE-only series', () => {
    const text = ics(
      event(['UID:sporadic@test', 'DTSTART:20200101T120000Z', 'RDATE:20260814T120000Z'])
    );

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual(['sporadic@test']);
  });

  it('keeps a RECURRENCE-ID override whatever its date', () => {
    // Drop one of these and the expander regenerates the occurrence at its
    // original time — an event that was moved or cancelled comes back.
    const text = ics(
      event([
        'UID:standup@test',
        'RECURRENCE-ID;TZID=America/New_York:20110412T090000',
        'DTSTART;TZID=America/New_York:20110412T110000',
      ])
    );

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual(['standup@test']);
  });

  it('keeps an event it cannot read a date from', () => {
    const text = ics(event(['UID:mystery@test', 'SUMMARY:no dtstart at all']));

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual(['mystery@test']);
  });

  it('keeps a long event that spans the window from before it', () => {
    // Starts in July, ends in September: never inside the window by its start.
    const text = ics(
      event(['UID:sabbatical@test', 'DTSTART:20260701', 'DTEND:20260901'])
    );

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual(['sabbatical@test']);
  });

  it('keeps the envelope and every VTIMEZONE', () => {
    // The surviving events' TZIDs point at these.
    const trimmed = trimIcs(
      ics(event(['UID:ancient@test', 'DTSTART:20110704T120000Z'])),
      '2026-08-10',
      '2026-08-16'
    );

    expect(trimmed).toContain('BEGIN:VCALENDAR');
    expect(trimmed).toContain('END:VCALENDAR');
    expect(trimmed).toContain('BEGIN:VTIMEZONE');
    expect(trimmed).toContain('TZID:America/New_York');
    // The VTIMEZONE's own 1970 DTSTART must not be read as an event's.
    expect(trimmed).toContain('DTSTART:19700101T000000');
  });

  it('is not fooled by a description that quotes ICS at itself', () => {
    // A folded continuation line begins with a space, which is what separates
    // "text inside a value" from "a property".
    const text = ics(
      event([
        'UID:meta@test',
        'DTSTART:20260813T120000Z',
        'DESCRIPTION:paste this into a file:',
        ' BEGIN:VEVENT',
        ' RRULE:FREQ=DAILY',
        ' END:VEVENT',
      ]),
      event(['UID:ancient@test', 'DTSTART:20110704T120000Z'])
    );

    const trimmed = trimIcs(text, '2026-08-10', '2026-08-16');

    expect(uids(trimmed)).toEqual(['meta@test']);
    // And the quoted text survives intact inside the event that was kept.
    expect(trimmed).toContain(' BEGIN:VEVENT');
  });

  it('does not mistake DTSTAMP for DTSTART', () => {
    // Every Google event carries a DTSTAMP of when the feed was generated, i.e.
    // today — reading it as the start date would keep every event ever.
    const text = ics(
      event(['UID:ancient@test', 'DTSTAMP:20260813T101010Z', 'DTSTART:20110704T120000Z'])
    );

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual([]);
  });

  it('pads the window, so a zone offset cannot drop a wanted event', () => {
    // 03:00Z on the 17th is the 16th at 23:00 in New York — inside a window
    // ending on the 16th, and outside it by the stamp alone.
    const text = ics(event(['UID:late@test', 'DTSTART:20260817T030000Z']));

    expect(uids(trimIcs(text, '2026-08-10', '2026-08-16'))).toEqual(['late@test']);
  });

  it('returns the feed untouched when it does not recognise the shape', () => {
    const unbalanced = ics(['BEGIN:VEVENT', 'UID:broken@test'].join('\r\n'));

    expect(trimIcs(unbalanced, '2026-08-10', '2026-08-16')).toBe(unbalanced);
    expect(trimIcs('not a calendar at all', '2026-08-10', '2026-08-16')).toBe(
      'not a calendar at all'
    );
    // An unreadable window is not a reason to guess.
    const fine = ics(event(['UID:x@test', 'DTSTART:20110704T120000Z']));
    expect(trimIcs(fine, 'whenever', '2026-08-16')).toBe(fine);
  });

  it('preserves a feed that uses bare newlines', () => {
    const text = ics(event(['UID:now@test', 'DTSTART:20260813T120000Z'])).replace(/\r\n/g, '\n');

    expect(trimIcs(text, '2026-08-10', '2026-08-16')).not.toContain('\r');
  });
});

describe('trimming changes nothing about the answer', () => {
  it('expands to exactly what the untrimmed feed expands to', () => {
    // The property that makes the optimisation safe, asserted end to end against
    // a feed with one of everything.
    const feed = ics(
      event(['UID:ancient@test', 'SUMMARY:2011 picnic', 'DTSTART:20110704T120000Z', 'DTEND:20110704T130000Z']),
      event(['UID:future@test', 'SUMMARY:next year', 'DTSTART:20271201T120000Z', 'DTEND:20271201T130000Z']),
      event(['UID:now@test', 'SUMMARY:this week', 'DTSTART:20260813T160000Z', 'DTEND:20260813T170000Z']),
      event(['UID:allday@test', 'SUMMARY:a whole day', 'DTSTART;VALUE=DATE:20260815', 'DTEND;VALUE=DATE:20260816']),
      event([
        'UID:standup@test',
        'SUMMARY:standup',
        'DTSTART;TZID=America/New_York:20190107T090000',
        'DTEND;TZID=America/New_York:20190107T091500',
        'RRULE:FREQ=WEEKLY;BYDAY=TH',
      ]),
      event([
        'UID:standup@test',
        'SUMMARY:standup, moved',
        'RECURRENCE-ID;TZID=America/New_York:20260813T090000',
        'DTSTART;TZID=America/New_York:20260813T110000',
        'DTEND;TZID=America/New_York:20260813T111500',
      ])
    );

    const trimmed = trimIcs(feed, '2026-08-10', '2026-08-16');

    expect(expandIcs(trimmed, '2026-08-10', '2026-08-16', EST)).toEqual(
      expandIcs(feed, '2026-08-10', '2026-08-16', EST)
    );
    // And it really did drop something, or this asserts nothing.
    expect(trimmed.length).toBeLessThan(feed.length);
    // Including the moved occurrence, which reports its own time rather than
    // the series' 9am. Both values below are an hour later than the ICS says
    // because this fixture's VTIMEZONE declares only a STANDARD rule, so ical.js
    // reads `TZID=America/New_York` as -0500 in August while `expandIcs` renders
    // the resulting instant in the real zone at -0400. That's the fixture being
    // terse, not the code: the assertion that matters is the equality above.
    const expanded = expandIcs(trimmed, '2026-08-10', '2026-08-16', EST);
    expect(expanded.find((e) => e.title === 'standup, moved')?.start).toBe('2026-08-13T12:00:00');
    expect(expanded.some((e) => e.start === '2026-08-13T10:00:00')).toBe(false);
  });
});
