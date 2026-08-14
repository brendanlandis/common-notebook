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

// Reviews are per-period and the account is real, so a spec that committed a
// review for the live period would collide with Brendan's own. Everything here
// cleans up after itself.
async function deleteReviewsCovering(request: any, iso: string) {
  const res = await request.get(`/api/reviews?on=${iso}`);
  const body = await res.json().catch(() => ({ success: false }));
  if (!body.success) return;
  for (const review of body.data ?? []) {
    await request.delete(`/api/reviews/${review.documentId}`).catch(() => {});
  }
}

test.describe('review', () => {
  test('commits a selection and reads it back on the daily page', async ({ page, request }) => {
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
      await page.goto('/review/weekly');

      // A positive signal rather than waiting for "loading..." to detach — the
      // page has two sequential gates and the text can vanish in the gap.
      await expect(
        page.getByRole('heading', { name: 'review', exact: true })
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
      // And picking it *is* the save; there is no commit button to press.
      await page.getByRole('button', { name: chosen.title, pressed: false }).click();
      await expect(
        page.getByRole('button', { name: chosen.title, pressed: true })
      ).toBeVisible();
      // And it moves out of its project group into the picked list above.
      await expect(
        page.locator('section', { has: page.getByRole('heading', { name: 'picked' }) })
          .getByRole('button', { name: chosen.title })
      ).toBeVisible();
      await expect(page.getByText(/saved/)).toBeVisible({ timeout: 15_000 });

      await page.goto('/review/daily');
      await expect(page.getByRole('heading', { name: 'today' })).toBeVisible({
        timeout: 30_000,
      });

      // The committed task is there; the one left unticked is not.
      await expect(page.getByText(chosen.title)).toBeVisible();
      await expect(page.getByText(ignored.title)).toHaveCount(0);
    } finally {
      const today = new Date().toISOString().slice(0, 10);
      await deleteReviewsCovering(request, today);
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
      await page.goto('/review/weekly');
      await expect(
        page.getByRole('heading', { name: 'review', exact: true })
      ).toBeVisible({ timeout: 30_000 });

      // `fulfill`, not `abort`. A 500 *resolves*, so code guarded by
      // `if (!response.ok) return` does nothing on a server error while an abort
      // still lands in catch — an aborted request would pass against code that
      // mishandles the real case.
      await page.route('**/api/reviews', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ success: false, error: 'nope' }),
            })
          : route.continue()
      );

      await page.getByRole('button', { name: task.title, pressed: false }).click();

      // The point: the failure is shown, not swallowed into a console.error while
      // the page pretends it saved.
      await expect(page.getByText(/couldn't save that/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/^saved/)).toHaveCount(0);
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });
});
