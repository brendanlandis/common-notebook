import { test, expect, type Page } from '@playwright/test';
import { gotoTodo, openManageCluster, waitUntilStill } from './helpers';

// What the header does with its room, which only a browser can show: jsdom lays
// nothing out.
//
// The buttons from add task on wrap to a new line as one, and the hidden manage
// buttons keep their room while hidden. When those took no room until shown, a
// caret at the end of a line looped on hover: the buttons opened, the caret
// wrapped out from under the pointer, they closed, it came back, and they opened
// again, about every 140ms.
//
// And a tooltip near the edge of the window, or of the menu drawer, moves its
// bubble inside it, with its tail still on the button.

/**
 * A phone keeps its own width. A desktop engine also tries two narrow ones: at
 * 500px every button just fits on the first line, and at 480 they wrap.
 */
const widthsFor = (isMobile: boolean) => (isMobile ? [0] : [1280, 500, 480]);

const atWidth = async (page: Page, width: number) => {
  // Out of the way first. A pointer left where the next page puts the caret
  // never enters it, so hovering it there again would open nothing.
  await page.mouse.move(0, 0);
  if (width) await page.setViewportSize({ width, height: 800 });
  await gotoTodo(page);
};

const middle = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  return box!.y + box!.height / 2;
};

/**
 * Where a tooltip's bubble (daisyUI's `::before`) and tail (`::after`) render,
 * from the browser's resolved styles: each hangs from the middle of its button
 * (`left: 50%`), pulled back by half its width, and the bubble also moved by
 * `translate`. The tail is turned about its own middle, which that leaves put.
 */
const placeTip = (page: Page, tip: string) =>
  page.locator(`[data-tip="${tip}"]`).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const place = (pseudo: string) => {
      const style = getComputedStyle(el, pseudo);
      const width = parseFloat(style.width);
      const moved = style.translate === 'none' ? 0 : parseFloat(style.translate);
      const left =
        box.left + el.clientLeft + parseFloat(style.left) + moved + new DOMMatrix(style.transform).e;
      return { left, right: left + width, middle: left + width / 2, opacity: style.opacity };
    };
    return { bubble: place('::before'), tail: place('::after'), button: box.left + box.width / 2 };
  });

/** Hover a tooltip's button and check that its bubble shows between `left` and `right`. */
const expectTipWithin = async (page: Page, tip: string, left: number, right: number) => {
  await page.locator(`[data-tip="${tip}"]`).hover();
  await expect.poll(async () => (await placeTip(page, tip)).bubble.opacity).toBe('1');
  const { bubble, tail, button } = await placeTip(page, tip);
  expect(bubble.left, `${tip}: bubble runs off the left`).toBeGreaterThanOrEqual(left - 0.5);
  expect(bubble.right, `${tip}: bubble runs off the right`).toBeLessThanOrEqual(right + 0.5);
  expect(Math.abs(tail.middle - button), `${tip}: tail isn't on its button`).toBeLessThan(1);
  expect(tail.middle, `${tip}: tail is left outside the bubble`).toBeGreaterThan(bubble.left);
  expect(tail.middle, `${tip}: tail is left outside the bubble`).toBeLessThan(bubble.right);
};

const scrollsSideways = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => el.scrollWidth > el.clientWidth);

test.describe('header', () => {
  test('opening the manage buttons never moves the caret', async ({ page, isMobile }) => {
    for (const width of widthsFor(isMobile)) {
      await test.step(width ? `at ${width}px` : 'at the phone width', async () => {
        await atWidth(page, width);
        const caret = page.getByRole('button', { name: 'more buttons' });
        const before = await caret.boundingBox();

        await openManageCluster(page);
        // Watch it for longer than the loop took to go round.
        const seen = new Set<string>();
        for (let i = 0; i < 12; i++) {
          const box = await caret.boundingBox();
          seen.add(`${await caret.getAttribute('aria-expanded')} at ${box?.x},${box?.y}`);
          await page.waitForTimeout(50);
        }
        expect([...seen]).toEqual([`true at ${before?.x},${before?.y}`]);

        // Out in full, on the caret's line, with every button from add task on.
        await expect(page.getByRole('button', { name: 'manage views' })).toBeInViewport({ ratio: 1 });
        const line = await middle(page, '[aria-label="more buttons"]');
        for (const tip of ['add task', 'add project', 'declutter', 'manage views']) {
          expect(await middle(page, `[data-tip="${tip}"]`), `${tip} is off the caret's line`).toBeCloseTo(line, 0);
        }
      });
    }
  });

  test('a tooltip keeps its bubble in view, its tail on its button', async ({ page, isMobile }) => {
    for (const width of widthsFor(isMobile)) {
      await test.step(width ? `at ${width}px` : 'at the phone width', async () => {
        await atWidth(page, width);
        const inWindow = await page.evaluate(() => document.documentElement.clientWidth);
        for (const tip of ['add task', 'add project', 'declutter']) {
          await expectTipWithin(page, tip, 0, inWindow);
        }
        await openManageCluster(page);
        await waitUntilStill(page, page.getByRole('button', { name: 'manage views' }), 'manage buttons');
        for (const tip of ['manage projects', 'manage worlds', 'manage views']) {
          await expectTipWithin(page, tip, 0, inWindow);
        }
        expect(await scrollsSideways(page, 'html'), 'the page scrolls sideways').toBe(false);

        // The menu drawer's edge comes before the window's.
        await page.getByRole('button', { name: 'open menu' }).click();
        const drawer = page.getByRole('dialog');
        await waitUntilStill(page, drawer, 'menu drawer');
        const edges = await drawer.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return [box.left, box.right];
        });
        const theme = (await page.locator('#themeToggle').getAttribute('data-tip'))!;
        for (const tip of [theme, 'settings']) await expectTipWithin(page, tip, edges[0], edges[1]);
        expect(await scrollsSideways(page, '[role="dialog"]'), 'the menu scrolls sideways').toBe(false);
      });
    }
  });
});
