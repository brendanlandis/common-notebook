import { test, expect } from '@playwright/test';
import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  uniqueTitle,
} from './helpers';

/**
 * The review is client-rendered like the rest of the app, so SSR returns
 * `loading...` and neither curl nor a unit test can show that it works. These
 * drive the real thing.
 *
 * What they're really guarding is the round trip: a selection committed on the
 * review page has to come back out on the daily page. Every piece of that is
 * unit-tested in isolation and none of it proves the pieces are wired to each
 * other.
 */

/**
 * Reviews are per-period and the account is real, so this spec runs *inside the
 * user's own review* for the current period rather than beside it.
 *
 * That changed under it. When a review was only written by pressing "commit",
 * the spec could assume it was the one creating it and delete it afterwards.
 * Now a pick saves itself, so by the time this runs there is usually a real
 * review already there — and deleting it would throw away a real morning's
 * planning. So: remember what it held, and put that back.
 *
 * The same shift breaks the naive "wait for the POST" — an existing review is
 * updated, not created — hence `reviewWritten` accepting either verb.
 */
interface ReviewSnapshot {
  documentId: string;
  tasks: string[];
}

async function reviewCovering(request: any, iso: string): Promise<ReviewSnapshot | null> {
  const res = await request.get(`/api/reviews?on=${iso}`);
  const body = await res.json().catch(() => ({ success: false }));
  const review = body.success ? body.data?.[0] : null;
  return review
    ? {
        documentId: review.documentId,
        tasks: (review.tasks ?? []).map((task: { documentId: string }) => task.documentId),
      }
    : null;
}

/** Put the user's own selection back, or remove the review this spec created. */
async function restoreReview(request: any, iso: string, before: ReviewSnapshot | null) {
  const after = await reviewCovering(request, iso).catch(() => null);
  if (!after) return;
  if (before) {
    await request
      .put(`/api/reviews/${before.documentId}`, { data: { tasks: before.tasks } })
      .catch(() => {});
  } else {
    await request.delete(`/api/reviews/${after.documentId}`).catch(() => {});
  }
}

/** A pick reaching the server, whether it created the review or updated one. */
const reviewWritten = (page: any) =>
  page.waitForResponse(
    (response: any) =>
      /\/api\/reviews(\/|$|\?)/.test(new URL(response.url()).pathname + '?') &&
      ['POST', 'PUT'].includes(response.request().method())
  );

test.describe('review', () => {
  test('commits a selection and reads it back on the daily page', async ({ page, request }) => {
    const today = new Date().toISOString().slice(0, 10);
    // What the account's own review holds right now, so it can be handed back
    // exactly as found.
    const before = await reviewCovering(request, today);

    // Titles deliberately avoid the word "review": the page's own <h1> is
    // "review", and a fixture containing it makes every heading locator
    // ambiguous under Playwright's strict mode.
    const project = await createProject(request, {
      title: uniqueTitle('big thing'),
      importance: 'top of mind',
    });
    const chosen = await createTask(request, {
      title: uniqueTitle('chosen'),
      project: project.documentId,
    });
    const ignored = await createTask(request, {
      title: uniqueTitle('ignored'),
      project: project.documentId,
    });

    try {
      await page.goto('/review/periodic');

      // A positive signal rather than waiting for "loading..." to detach — the
      // page has two sequential gates and the text can vanish in the gap.
      await expect(
        page.getByRole('heading', { name: 'periodic review', exact: true })
      ).toBeVisible({ timeout: 30_000 });

      // The top-of-mind project titles its own list.
      await expect(page.getByRole('heading', { name: project.title })).toBeVisible();

      // Review for the rest of the current cycle, so the period covers today and
      // the daily page can find it. Set the mode before picking: the selection
      // is what's being committed, and this keeps the order of operations the
      // same as a person's.
      //
      // Located by name, not by label text: the labels read "this week" / "next
      // week" off whatever cadence the account is configured for, so matching
      // text would break on a schedule change that has nothing to do with this.
      // Unchecked is "this cycle" — the switch reads left-to-right.
      await page.locator('input[name="review-mode"]').uncheck();
      // A pill, not a checkbox — checking one off is what a checkbox means
      // everywhere else in this app, and nothing on this page completes a task.
      // And picking it *is* the save; there is no commit button to press, and no
      // confirmation to wait for either, so the write is awaited directly.
      const written = reviewWritten(page);
      await page.getByRole('button', { name: chosen.title, pressed: false }).click();
      await expect(
        page.getByRole('button', { name: chosen.title, pressed: true })
      ).toBeVisible();
      // And it moves out of its project group into the picked list above. That
      // heading names the period rather than the act of picking — "this week" on
      // a weekly cadence — so it's located by position instead of by text, which
      // would otherwise break the moment the account changed its review
      // schedule.
      // Located structurally: the picked list is the one hanging directly off a
      // section, where every list in the pool below sits inside a project group.
      await expect(
        page.locator('.review-section > .review-pick-list')
          .getByRole('button', { name: chosen.title })
      ).toBeVisible();
      expect((await written).ok()).toBe(true);

      await page.goto('/review/daily');
      await expect(page.getByRole('heading', { name: 'today' })).toBeVisible({
        timeout: 30_000,
      });

      // If the account has already narrowed today to a few things, the reading
      // view shows only those — so open the picker, which lists the review's
      // whole selection. Reading around the user's state rather than clearing
      // it: a daily pick is a real decision someone made this morning.
      const changePicks = page.getByRole('button', { name: /change today's picks/ });
      if (await changePicks.count()) await changePicks.click();

      // The committed task is there; the one left unticked is not.
      await expect(page.getByText(chosen.title)).toBeVisible();
      await expect(page.getByText(ignored.title)).toHaveCount(0);
    } finally {
      await restoreReview(request, today, before);
      await deleteTask(request, chosen.documentId);
      await deleteTask(request, ignored.documentId);
      await deleteProject(request, project.documentId);
    }
  });

  test('shows a real error when a pick fails to save', async ({ page, request }) => {
    const project = await createProject(request, {
      title: uniqueTitle('doomed thing'),
      importance: 'top of mind',
    });
    const task = await createTask(request, {
      title: uniqueTitle('doomed'),
      project: project.documentId,
    });

    try {
      await page.goto('/review/periodic');
      await expect(
        page.getByRole('heading', { name: 'periodic review', exact: true })
      ).toBeVisible({ timeout: 30_000 });

      // `fulfill`, not `abort`. A 500 *resolves*, so code guarded by
      // `if (!response.ok) return` does nothing on a server error while an abort
      // still lands in catch — an aborted request would pass against code that
      // mishandles the real case.
      //
      // Both verbs, because which one a pick uses depends on whether the account
      // already has a review for this period — and it usually does now that
      // picking saves itself. Intercepting only the POST let the real PUT
      // through, so the write succeeded, no error appeared, and the failure
      // looked like the page swallowing it. It also means this test cannot
      // touch the user's own selection: neither verb reaches the server.
      const failWrite = (route: any) =>
        ['POST', 'PUT'].includes(route.request().method())
          ? route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ success: false, error: 'nope' }),
            })
          : route.continue();
      await page.route('**/api/reviews', failWrite);
      await page.route('**/api/reviews/*', failWrite);

      await page.getByRole('button', { name: task.title, pressed: false }).click();

      // The point: the failure is shown, not swallowed into a console.error while
      // the page pretends it saved.
      await expect(page.getByText(/couldn't save that/i)).toBeVisible({ timeout: 15_000 });
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });
});
