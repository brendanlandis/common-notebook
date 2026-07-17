import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { uniqueTitle, deleteTask, createTask, gotoTodo } from './helpers';

// The Done page groups completed tasks by *effective day* — the calendar day after
// the account's day-boundary hour is applied. This is the wiring behind the bug
// that started this whole audit: a completion just after midnight must group with
// the previous evening, not with that afternoon. Playwright can't move the server
// clock, so we write completions at known instants (via the BFF) a few days back
// and assert *relative* grouping, which needs no knowledge of today's label.
//
// The account under test is brendan's, timezone America/New_York — so we build the
// completion instants from NY wall-clock times.

const TZ = 'America/New_York';
const BOUNDARY_TITLE = 'dayBoundaryHour';

// Native Intl helpers (no library): Playwright's CJS loader can't resolve the app's
// ESM-only temporal-polyfill, and the spec only needs to compute test instants — it
// verifies the app's own Temporal date logic through the running server, not here.
const nyParts = (d: Date, withTime = false) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : {}),
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;

const nyDate = (d: Date) => {
  const p = nyParts(d);
  return `${p.year}-${p.month}-${p.day}`;
};
const shiftDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
// A UTC ISO instant for a given NY wall-clock date + HH:mm, via NY's offset at that
// time (the standard formatToParts round-trip).
const nyInstant = (dateISO: string, hhmm: string) => {
  const asUTC = new Date(`${dateISO}T${hhmm}:00Z`);
  const p = nyParts(asUTC, true);
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asIfLocal = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  const offsetMs = asIfLocal - asUTC.getTime();
  return new Date(asUTC.getTime() - offsetMs).toISOString();
};

async function getBoundary(request: APIRequestContext): Promise<number> {
  const res = await request.get(`/api/system-settings?title=${BOUNDARY_TITLE}`);
  const body = await res.json();
  const parsed = parseInt(body?.value ?? '4', 10);
  return Number.isNaN(parsed) ? 4 : parsed;
}
async function setBoundary(request: APIRequestContext, hour: number) {
  const res = await request.put('/api/system-settings', {
    data: { title: BOUNDARY_TITLE, value: String(hour) },
  });
  expect((await res.json()).success, 'failed to set day boundary').toBe(true);
}

async function createCompleted(request: APIRequestContext, title: string, completedAt: string) {
  const res = await request.post('/api/tasks', {
    data: { title, recurrenceType: 'none', completed: true, completedAt },
  });
  const body = await res.json();
  expect(body.success, `createCompleted failed: ${JSON.stringify(body)}`).toBe(true);
  return body.data.documentId as string;
}

/** The Done-page section heading a task's row sits under. */
async function sectionHeadingOf(page: import('@playwright/test').Page, documentId: string) {
  return page.locator(`.task-section:has(#task-${documentId}) h3`).first().innerText();
}

test.describe('Done page day-boundary bucketing', () => {
  // base is 5 days back in NY, safely inside the 30-day Done window.
  const base = shiftDays(nyDate(new Date()), -5);
  const prev = shiftDays(base, -1);

  test('groups an after-midnight completion with the previous evening under a 3am boundary', async ({
    page,
    request,
  }) => {
    const original = await getBoundary(request);
    const titleA = uniqueTitle('done-1am');
    const titleB = uniqueTitle('done-2pm');
    const titleC = uniqueTitle('done-prev-8pm');
    let a = '', b = '', c = '';

    try {
      await setBoundary(request, 3);
      a = await createCompleted(request, titleA, nyInstant(base, '01:00')); // 1am base → effective prev
      b = await createCompleted(request, titleB, nyInstant(base, '14:00')); // 2pm base → effective base
      c = await createCompleted(request, titleC, nyInstant(prev, '20:00')); // 8pm prev → effective prev

      await gotoTodo(page, '/todo/view/done');
      await expect(page.locator(`#task-${a}`)).toBeVisible({ timeout: 30_000 });

      const [ha, hb, hc] = await Promise.all([
        sectionHeadingOf(page, a),
        sectionHeadingOf(page, b),
        sectionHeadingOf(page, c),
      ]);

      // 1am and the previous 8pm are the same effective day; the 2pm is not.
      expect(ha).toBe(hc);
      expect(ha).not.toBe(hb);
    } finally {
      await setBoundary(request, original);
      await Promise.all([a, b, c].filter(Boolean).map((id) => deleteTask(request, id)));
    }
  });

  test('changing the day boundary in /settings moves the grouping', async ({ page, request }) => {
    const original = await getBoundary(request);
    const titleA = uniqueTitle('bnd-1am');
    const titleB = uniqueTitle('bnd-2pm');
    const titleC = uniqueTitle('bnd-prev-8pm');
    let a = '', b = '', c = '';

    try {
      await setBoundary(request, 3);
      a = await createCompleted(request, titleA, nyInstant(base, '01:00'));
      b = await createCompleted(request, titleB, nyInstant(base, '14:00'));
      c = await createCompleted(request, titleC, nyInstant(prev, '20:00'));

      // Under 3am: A groups with C (previous day), apart from B.
      await gotoTodo(page, '/todo/view/done');
      await expect(page.locator(`#task-${a}`)).toBeVisible({ timeout: 30_000 });
      expect(await sectionHeadingOf(page, a)).toBe(await sectionHeadingOf(page, c));
      expect(await sectionHeadingOf(page, a)).not.toBe(await sectionHeadingOf(page, b));

      // Move the boundary to midnight via the real settings control.
      await page.goto('/settings');
      const boundarySelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="3"]') }); // only the boundary select has 0..23
      await expect(boundarySelect).toBeVisible({ timeout: 30_000 });
      await boundarySelect.selectOption('0');

      // Under midnight: 1am now belongs to `base`, grouping with the 2pm, apart from C.
      await gotoTodo(page, '/todo/view/done');
      await expect(page.locator(`#task-${a}`)).toBeVisible({ timeout: 30_000 });
      expect(await sectionHeadingOf(page, a)).toBe(await sectionHeadingOf(page, b));
      expect(await sectionHeadingOf(page, a)).not.toBe(await sectionHeadingOf(page, c));
    } finally {
      await setBoundary(request, original);
      await Promise.all([a, b, c].filter(Boolean).map((id) => deleteTask(request, id)));
    }
  });
});

test.describe('Done page upcoming panel (R1/R2)', () => {
  // The upcoming panel used addDays on an instant, so on a UTC host serving a NY
  // user it collapsed "tomorrow" onto today and duplicated a day across fall-back.
  // Here we assert the first upcoming day is labelled "tomorrow" and every day
  // appears in exactly one bucket.
  test('labels tomorrow correctly and files each upcoming day exactly once', async ({ page, request }) => {
    const today = nyDate(new Date());
    const tomorrow = shiftDays(today, 1);
    const threeOut = shiftDays(today, 3);
    const titleTom = uniqueTitle('up-tomorrow');
    const titleThree = uniqueTitle('up-3out');
    let t1 = '', t2 = '';

    try {
      t1 = (await createTask(request, { title: titleTom, displayDate: tomorrow })).documentId;
      t2 = (await createTask(request, { title: titleThree, displayDate: threeOut })).documentId;

      await gotoTodo(page, '/todo/view/done');
      await expect(page.locator(`#task-${t1}`)).toBeVisible({ timeout: 30_000 });

      // Each task sits in exactly one upcoming-day bucket (no duplication — R2).
      await expect(page.locator(`.upcoming-day:has(#task-${t1})`)).toHaveCount(1);
      await expect(page.locator(`.upcoming-day:has(#task-${t2})`)).toHaveCount(1);

      // The nearest day is labelled "tomorrow"; the +3 day is a different, later label (R1).
      const h1 = await page.locator(`.upcoming-day:has(#task-${t1}) h4`).innerText();
      const h2 = await page.locator(`.upcoming-day:has(#task-${t2}) h4`).innerText();
      expect(h1.toLowerCase()).toBe('tomorrow');
      expect(h2.toLowerCase()).not.toBe('tomorrow');
    } finally {
      await Promise.all([t1, t2].filter(Boolean).map((id) => deleteTask(request, id)));
    }
  });
});
