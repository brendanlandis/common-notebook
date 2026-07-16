import { test, expect } from '@playwright/test';

// The honest version of a test the unit suite can only fake: a real failed request
// driving the real onMutate/onError rollback in useViews. Nothing is mocked — the
// PUTs are aborted at the network layer, so nothing lands server-side either and
// the account's real view order is untouched.
//
// This is the pattern Stage 5's optimistic task mutations will be checked with.

const viewNames = (page: import('@playwright/test').Page) =>
  page.locator('li.view-row input[aria-label="view name"]').evaluateAll(
    (els) => els.map((el) => (el as HTMLInputElement).value)
  );

test.describe('view reorder', () => {
  test('rolls back when the save fails', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('li.view-row').first()).toBeVisible({ timeout: 30_000 });

    const before = await viewNames(page);
    expect(before.length, 'need at least 2 views to reorder').toBeGreaterThan(1);

    // Abort only the position writes. The GET that lists views must survive, or
    // the page would have nothing to render and the test would pass vacuously.
    await page.route('**/api/views/*', async (route) => {
      if (route.request().method() === 'PUT') return route.abort('failed');
      return route.fallback();
    });

    // Move the second view up; the optimistic update should swap it with the first.
    await page.locator('li.view-row').nth(1).getByLabel('move up').click();

    // It ends up back where it started. The swap itself is optimistic and may be
    // reverted faster than we can observe, so assert the settled state.
    await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(before);
  });

  test('a successful reorder sticks', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('li.view-row').first()).toBeVisible({ timeout: 30_000 });

    const before = await viewNames(page);
    expect(before.length).toBeGreaterThan(1);
    const swapped = [before[1], before[0], ...before.slice(2)];

    try {
      await page.locator('li.view-row').nth(1).getByLabel('move up').click();
      await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(swapped);

      // Survives a reload — i.e. the N PUTs actually persisted.
      await page.reload();
      await expect(page.locator('li.view-row').first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(swapped);
    } finally {
      // Put the account's real order back, whatever happened above.
      await page.reload();
      await expect(page.locator('li.view-row').first()).toBeVisible({ timeout: 30_000 });
      const now = await viewNames(page);
      if (now[0] !== before[0]) {
        await page.locator('li.view-row').nth(1).getByLabel('move up').click();
        await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(before);
      }
    }
  });
});
