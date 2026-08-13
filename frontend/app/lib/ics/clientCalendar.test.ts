import { describe, it, expect } from 'vitest';
import { toClientCalendar } from './clientCalendar';

/**
 * The one invariant the calendar routes exist to hold: **`icsUrl` never reaches
 * the browser.**
 *
 * A secret ICS URL is a bearer credential — the link *is* the access. It can't
 * be a `private` schema field, because Strapi would then hide it from this app's
 * own server too and the poller could not read it. So the protection is a line
 * of code, and a line of code is what a later refactor deletes without noticing.
 *
 * These cover the shaper. The e2e spec asserts the actual HTTP body, because a
 * unit test can prove the function is correct but not that the route calls it.
 */

const row = {
  documentId: 'cal-1',
  name: 'Work',
  icsUrl: 'https://calendar.google.com/calendar/ical/x/private-secret/basic.ics',
  color: '#336699',
  position: 0,
  defaultState: 'unset' as const,
};

describe('toClientCalendar', () => {
  it('omits icsUrl entirely', () => {
    const client = toClientCalendar(row);

    expect(client).not.toHaveProperty('icsUrl');
    expect(JSON.stringify(client)).not.toContain('private-secret');
  });

  it('reports only whether a url is set', () => {
    expect(toClientCalendar(row).hasUrl).toBe(true);
    expect(toClientCalendar({ ...row, icsUrl: undefined }).hasUrl).toBe(false);
  });

  it('passes through the fields the browser does need', () => {
    expect(toClientCalendar(row)).toEqual({
      documentId: 'cal-1',
      name: 'Work',
      color: '#336699',
      position: 0,
      defaultState: 'unset',
      hasUrl: true,
    });
  });

  it('defaults a missing state to unset rather than null', () => {
    // Unset is a real, visible state — the review is finished when nothing is
    // unset — so it must not arrive as null and be rendered as something else.
    expect(toClientCalendar({ ...row, defaultState: null }).defaultState).toBe('unset');
    expect(toClientCalendar({ documentId: 'c', name: 'n' }).defaultState).toBe('unset');
  });
});
