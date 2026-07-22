import { test, expect, Page } from '@playwright/test';
import { gotoTodo } from './helpers';

// The honest version of a test the unit suite can only fake: a real failed request
// driving the real onMutate/onError rollback in useViews. Nothing is mocked — the
// PUTs are aborted at the network layer, so nothing lands server-side either and
// the account's real view order is untouched.
//
// Views moved out of /settings into the To Do header's views drawer, and the ↑/↓
// buttons were replaced by drag handles, so this drives dnd-kit directly. It has
// to: a single mouse.move (or page.dragTo) does not trip the PointerSensor's 6px
// activation constraint, and dnd-kit only recomputes the drop target on movement,
// so the drag is pressed and stepped rather than teleported.

// The drawer slides in, and toBeVisible() does not wait for that to finish —
// boundingBox() mid-transition reports a negative x, so a drag measured then is
// driven entirely off-screen. It still emits pointer events, so the drag silently
// does nothing and a rollback assertion passes vacuously. Wait for the panel to
// stop moving before measuring anything inside it.
const openViewsDrawer = async (page: Page) => {
  await gotoTodo(page);
  await page.getByRole('button', { name: 'views' }).click();
  await expect(page.locator('li.view-row').first()).toBeVisible({ timeout: 30_000 });

  const panel = page.locator('.actions-drawer');
  let prev = NaN;
  for (let i = 0; i < 60; i++) {
    const box = await panel.boundingBox();
    if (box && box.x === prev && box.x >= 0) return;
    prev = box ? box.x : NaN;
    await page.waitForTimeout(50);
  }
  throw new Error('views drawer never settled');
};

const viewNames = (page: Page) =>
  page.locator('li.view-row input[aria-label="view name"]').evaluateAll(
    (els) => els.map((el) => (el as HTMLInputElement).value)
  );

// Drag the row at `from` onto the row at `to`, by its handle.
//
// Move by the centre-to-centre distance plus an overshoot, not to the target's
// centre: sorting only commits once the dragged row's centre crosses the
// target's, and stopping exactly on it leaves the order unchanged.
const dragRow = async (page: Page, from: number, to: number) => {
  const rows = page.locator('li.view-row');
  const grip = (await rows.nth(from).locator('> button.drag-handle').boundingBox())!;
  const source = (await rows.nth(from).boundingBox())!;
  const target = (await rows.nth(to).boundingBox())!;

  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;
  const centreDelta =
    target.y + target.height / 2 - (source.y + source.height / 2);
  const delta = centreDelta + Math.sign(centreDelta) * 24;

  await page.mouse.move(x, y);
  await page.mouse.down();
  // Clear the PointerSensor's 6px activation constraint, then travel in steps —
  // dnd-kit only recomputes the drop target on movement, so one jump won't sort.
  await page.mouse.move(x, y + Math.sign(delta) * 10);
  await page.mouse.move(x, y + delta, { steps: 15 });
  await page.mouse.up();
};

// The keyboard path that replaced the ↑/↓ buttons: focus a handle, Space to
// lift, arrows to move, Space to drop.
const keyboardMove = async (page: Page, from: number, key: 'ArrowUp' | 'ArrowDown') => {
  await page.locator('li.view-row > button.drag-handle').nth(from).focus();
  await page.keyboard.press('Space');
  // Wait for the lift itself rather than sleeping: dnd-kit measures the layout
  // before it will respond to an arrow key, and a fixed 150ms made this flaky.
  await expect(page.locator('li.view-row.is-dragging')).toHaveCount(1, { timeout: 5_000 });
  // The class lands immediately, but dnd-kit measures the droppable rects a beat
  // later and ignores an arrow key that arrives before it has: without this the
  // lift succeeds and the move silently does nothing.
  await page.waitForTimeout(300);
  await page.keyboard.press(key);
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
};

test.describe('view reorder', () => {
  test('rolls back when the save fails', async ({ page }) => {
    await openViewsDrawer(page);

    const before = await viewNames(page);
    expect(before.length, 'need at least 2 views to reorder').toBeGreaterThan(1);

    // Abort only the position writes. The GET that lists views must survive, or
    // the drawer would have nothing to render and the test would pass vacuously.
    await page.route('**/api/views/*', async (route) => {
      if (route.request().method() === 'PUT') return route.abort('failed');
      return route.fallback();
    });

    // Drag the second view above the first; the optimistic update should swap them.
    await dragRow(page, 1, 0);

    // It ends up back where it started. The swap itself is optimistic and may be
    // reverted faster than we can observe, so assert the settled state.
    await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(before);
  });

  // Dropping the ↑/↓ buttons removed the only keyboard-accessible way to
  // reorder, so dnd-kit's KeyboardSensor is load-bearing, not a nicety. It also
  // regressed once already: while view rows rendered their sections expanded
  // (~600px tall), a lift succeeded but the arrow key could not move a row past
  // a much shorter neighbour.
  test('reorders from the keyboard', async ({ page }) => {
    await openViewsDrawer(page);

    const before = await viewNames(page);
    expect(before.length).toBeGreaterThan(1);
    const swapped = [before[1], before[0], ...before.slice(2)];

    try {
      await keyboardMove(page, 1, 'ArrowUp');
      await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(swapped);
    } finally {
      await openViewsDrawer(page);
      if ((await viewNames(page))[0] !== before[0]) {
        await keyboardMove(page, 1, 'ArrowUp');
        await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(before);
      }
    }
  });

  // Sections are the second sortable level, and the one that broke in three
  // separate ways: a nested DndContext made them inert, a stray
  // `.drawer-side li:last-of-type` rule absolutely positioned the last row out of
  // the list, and an index-keyed row with an uncontrolled label input reordered
  // the data without redrawing the label. Unlike views, section writes have no
  // optimistic update — they wait on a real round trip — so poll, don't sleep.
  test('reorders the sections inside a view', async ({ page }) => {
    await openViewsDrawer(page);

    const viewRow = page.locator('li.view-row').nth(0);
    await viewRow.locator('.view-sections-disclosure > .sections-toggle').click();
    const rows = viewRow.locator('li.view-section-row');
    if ((await rows.count()) < 2) test.skip(true, 'first view has only one section');

    const labels = () => rows.locator('input[aria-label="section label"]')
      .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
    const before = await labels();

    try {
      const grip = (await rows.nth(1).locator('> button.drag-handle').boundingBox())!;
      const src = (await rows.nth(1).boundingBox())!;
      const tgt = (await rows.nth(0).boundingBox())!;
      const x = grip.x + grip.width / 2;
      const y = grip.y + grip.height / 2;
      const centreDelta = tgt.y + tgt.height / 2 - (src.y + src.height / 2);
      const delta = centreDelta + Math.sign(centreDelta) * 24;

      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + Math.sign(delta) * 10);
      await page.mouse.move(x, y + delta, { steps: 15 });
      await page.mouse.up();

      await expect.poll(labels, { timeout: 15_000 }).toEqual([before[1], before[0]]);
    } finally {
      // Restore by dragging back, then confirm it persisted.
      await openViewsDrawer(page);
      const row = page.locator('li.view-row').nth(0);
      await row.locator('.view-sections-disclosure > .sections-toggle').click();
      const back = row.locator('li.view-section-row');
      const now = await back.locator('input[aria-label="section label"]')
        .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
      if (now[0] !== before[0]) {
        await back.nth(1).locator('> button.drag-handle').focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);
        await page.keyboard.press('Space');
        await expect
          .poll(() => back.locator('input[aria-label="section label"]')
            .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value)), { timeout: 15_000 })
          .toEqual(before);
      }
    }
  });

  test('a successful reorder sticks', async ({ page }) => {
    await openViewsDrawer(page);

    const before = await viewNames(page);
    expect(before.length).toBeGreaterThan(1);
    const swapped = [before[1], before[0], ...before.slice(2)];

    try {
      await dragRow(page, 1, 0);
      await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(swapped);

      // Survives a reload — i.e. the N PUTs actually persisted.
      await openViewsDrawer(page);
      await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(swapped);
    } finally {
      // Put the account's real order back, whatever happened above.
      await openViewsDrawer(page);
      const now = await viewNames(page);
      if (now[0] !== before[0]) {
        await dragRow(page, 1, 0);
        await expect.poll(() => viewNames(page), { timeout: 15_000 }).toEqual(before);
      }
    }
  });
});
