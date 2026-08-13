import { test, expect } from '@playwright/test';
import { uniqueTitle } from './helpers';

/**
 * The one thing about calendars that only a real request can prove: **the
 * secret ICS URL never comes back down the wire.**
 *
 * `toClientCalendar` is unit-tested, but a unit test can only show the shaper is
 * correct — not that every handler actually calls it. This asserts the bytes.
 *
 * Deliberately *not* asserting the rendered grid. The feed is fetched
 * server-side (for CORS, and because the URL is a credential), so Playwright's
 * `page.route` — which intercepts the browser's requests — cannot stand in for
 * it, and pointing the test at a real Google calendar would make it depend on
 * someone's private data and the network. The wall-clock rendering claim is
 * covered by `WeekCalendar.test.tsx` and the `expandIcs` suite instead, both run
 * across the TZ matrix.
 */

test.describe('calendar subscriptions', () => {
  test('never returns the ics url to the client', async ({ request }) => {
    const name = uniqueTitle('cal');
    const secretPath = `https://example.com/${Date.now()}-secret-feed.ics`;

    const created = await request.post('/api/calendars', {
      data: { name, icsUrl: secretPath },
    });
    const body = await created.json();
    expect(body.success, `createCalendar failed: ${JSON.stringify(body)}`).toBe(true);
    const calendarId = body.data.documentId;

    try {
      // On create...
      expect(body.data).not.toHaveProperty('icsUrl');
      expect(JSON.stringify(body)).not.toContain('secret-feed');

      // ...and on read.
      const listed = await (await request.get('/api/calendars')).json();
      expect(JSON.stringify(listed)).not.toContain('secret-feed');

      // The row is still there and usable — the URL is withheld, not lost.
      const mine = (listed.data as Array<{ documentId: string; hasUrl: boolean }>).find(
        (c) => c.documentId === calendarId
      );
      expect(mine?.hasUrl, 'the calendar should report that it has a url').toBe(true);
    } finally {
      await request.delete(`/api/calendars/${calendarId}`).catch(() => {});
    }
  });

  test('refuses a non-https url', async ({ request }) => {
    // A stored javascript: or file: value would later be handed to a
    // server-side fetch, which is a much worse place to find out.
    const response = await request.post('/api/calendars', {
      data: { name: uniqueTitle('bad'), icsUrl: 'file:///etc/passwd' },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).success).toBe(false);
  });
});
