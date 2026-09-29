import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  anyWorldId,
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  gotoProject,
  gotoTodo,
} from './helpers';

// How many columns a task view gets and how wide they are, which only a browser
// can show. The rules were a stylesheet counting columns with :has(), which the
// production build broke on prod only; they're decided on TaskGrid now
// (TaskSection.tsx), and this pins down what it does.
//
// The views and columns are the account's own, so every expectation is worked
// out from what rendered, never from fixed names or counts. One test builds its
// own sections instead: the account's may each have as many columns, and line
// up whatever the rule.

const GUTTER = 16; // the page's side padding
const GAP = 32; // between columns

/** The most columns across at this window width. */
const limitAt = (width: number) => (width < 640 ? 1 : width < 900 ? 2 : width < 1100 ? 3 : 4);

/** A phone keeps its own width. A desktop engine tries one width per limit, and a wide one. */
const widthsFor = (isMobile: boolean) => (isMobile ? [0] : [700, 1000, 1440, 1920]);

const stepName = (width: number) => (width ? `at ${width}px` : 'at the phone width');

const resize = async (page: Page, width: number) => {
  if (width) await page.setViewportSize({ width, height: 900 });
};

const windowWidth = (page: Page) => page.evaluate(() => document.documentElement.clientWidth);

/** Every grid on the page, and its columns' boxes. */
const grids = (page: Page) =>
  page.locator('.tasks-container').evaluateAll((all) =>
    all.map((grid) => {
      const box = grid.getBoundingClientRect();
      return {
        left: box.left,
        width: box.width,
        columns: [...grid.querySelectorAll(':scope > .task-section')].map((column) => {
          const r = column.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width };
        }),
      };
    })
  );

/** The address of the account's first view with this layout. */
const viewWith = async (request: APIRequestContext, layout: string) => {
  const body = await (await request.get('/api/views')).json();
  const view = (body.data as Array<{ slug: string; layout: string }>).find(
    (v) => v.layout === layout
  );
  return view ? `/view/${view.slug}` : null;
};

/**
 * Every grid keeps as many tracks as the page's widest has columns, up to the
 * limit, and its columns sit on them from the left, so they line up from one
 * grid to the next. A lone column is one column of a full row wide; otherwise
 * the columns share the row.
 */
const expectLinedUp = (all: Awaited<ReturnType<typeof grids>>, limit: number) => {
  const widest = Math.max(...all.map((grid) => grid.columns.length));
  const across = widest === 1 ? limit : Math.min(widest, limit);
  for (const grid of all) {
    const each = (grid.width - (across - 1) * GAP) / across;
    const firstRow = grid.columns.filter((c) => Math.abs(c.top - grid.columns[0].top) < 1);
    expect(firstRow, 'columns across the first row').toHaveLength(
      Math.min(grid.columns.length, across)
    );
    firstRow.forEach((column, i) =>
      expect(column.left, `column ${i + 1} on the page’s line`).toBeCloseTo(
        GUTTER + i * (each + GAP),
        0
      )
    );
    for (const column of grid.columns) expect(column.width).toBeCloseTo(each, 0);
  }
};

test.describe('task grid', () => {
  test('a view shows its columns side by side, up to the window’s limit, lined up across its sections', async ({
    page,
    isMobile,
  }) => {
    for (const width of widthsFor(isMobile)) {
      await test.step(stepName(width), async () => {
        await resize(page, width);
        await gotoTodo(page);
        expectLinedUp(await grids(page), limitAt(await windowWidth(page)));
      });
    }
  });

  test('a section with fewer columns keeps the widest section’s tracks', async ({
    page,
    request,
    isMobile,
  }) => {
    // Two projects with soon tasks over three without. Home becomes a view of
    // two sections, soon and the rest, over only these tasks, rewritten in the
    // browser: the account's own view and tasks are untouched.
    const world = await anyWorldId(request);
    const projects: string[] = [];
    const tasks: string[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const project = (await createProject(request, { world })).documentId;
        projects.push(project);
        tasks.push((await createTask(request, { project, soon: i < 2 })).documentId);
      }
      const ours = new Set(tasks);
      await page.route('**/api/tasks', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.data = body.data.filter((t: { documentId: string }) => ours.has(t.documentId));
        await route.fulfill({ response, json: body });
      });
      await page.route('**/api/views', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const section = {
          worldMode: 'all',
          worlds: [],
          projectType: 'any',
          recurrence: 'both',
          longOnly: false,
        };
        body.data.push({
          ...body.data[0],
          documentId: 'e2e-lined-up',
          slug: 'e2e-lined-up',
          name: '[e2e] lined up',
          position: -1,
          layout: 'projects',
          systemKey: null,
          sections: [
            { ...section, name: 'soon', importance: 'soonAndTopOfMind' },
            { ...section, name: 'the rest', importance: 'any' },
          ],
        });
        await route.fulfill({ response, json: body });
      });

      for (const width of widthsFor(isMobile)) {
        await test.step(stepName(width), async () => {
          await resize(page, width);
          await gotoTodo(page);
          const all = await grids(page);
          expect(all.map((grid) => grid.columns.length), 'columns in each section').toEqual([2, 3]);
          expectLinedUp(all, limitAt(await windowWidth(page)));
        });
      }
    } finally {
      for (const task of tasks) await deleteTask(request, task);
      for (const project of projects) await deleteProject(request, project);
    }
  });

  test('a project page’s one column is one column of a full row wide, on the left', async ({
    page,
    request,
    isMobile,
  }) => {
    const project = await createProject(request);
    const task = await createTask(request, { project: project.documentId });
    try {
      for (const width of widthsFor(isMobile)) {
        await test.step(stepName(width), async () => {
          await resize(page, width);
          await gotoProject(page, project.documentId);
          const limit = limitAt(await windowWidth(page));
          const [grid] = await grids(page);
          expect(grid.columns).toHaveLength(1);
          expect(grid.columns[0].left).toBeCloseTo(GUTTER, 0);
          expect(grid.columns[0].width).toBeCloseTo((grid.width - (limit - 1) * GAP) / limit, 0);
        });
      }
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });

  // Chronological and roulette views are one column by design: from 640px it's
  // centered in the window, past 1600px too, and as wide as its content up to a
  // readable measure, with the content on the left.
  for (const layout of ['chronological', 'roulette']) {
    test(`a ${layout} view is one centered column, as wide as its content`, async ({
      page,
      request,
      isMobile,
    }) => {
      const path = await viewWith(request, layout);
      test.skip(!path, `the account has no ${layout} view`);
      for (const width of isMobile ? [0] : [...widthsFor(false), 2560]) {
        await test.step(stepName(width), async () => {
          await resize(page, width);
          await page.goto(path!);
          const column = page.locator('.tasks-container > .task-section');
          // Roulette with nothing to pick from shows a line of text instead.
          const shown = await column
            .waitFor({ timeout: 30_000 })
            .then(() => true)
            .catch(() => false);
          test.skip(!shown, `the ${layout} view has no tasks to show`);

          const m = await column.evaluate((el) => {
            const box = el.getBoundingClientRect();
            const probe = document.createElement('div');
            probe.style.width = '65ch';
            el.append(probe);
            const measure = probe.getBoundingClientRect().width;
            probe.remove();
            const saved = el.style.cssText;
            el.style.maxWidth = 'none';
            el.style.width = 'max-content';
            const content = el.getBoundingClientRect().width;
            el.style.cssText = saved;
            return {
              left: box.left,
              width: box.width,
              measure,
              content,
              task: el.querySelector('li')!.getBoundingClientRect().left,
              window: document.documentElement.clientWidth,
            };
          });
          const room = m.window - 2 * GUTTER;
          if (m.window < 640) {
            expect(m.left).toBeCloseTo(GUTTER, 0);
            expect(m.width).toBeCloseTo(room, 0);
          } else {
            expect(m.left + m.width / 2, 'centered in the window').toBeCloseTo(m.window / 2, 0);
            expect(m.width, 'as wide as its content, up to 65ch').toBeCloseTo(
              Math.min(m.content, m.measure, room),
              0
            );
          }
          expect(m.task, 'the content on the left').toBeCloseTo(m.left, 0);
        });
      }
    });
  }

  test('printing gives one column', async ({ page }) => {
    await gotoTodo(page);
    await page.emulateMedia({ media: 'print' });
    for (const grid of await grids(page)) {
      for (const column of grid.columns) {
        expect(column.left).toBeCloseTo(grid.left, 0);
        expect(column.width).toBeCloseTo(grid.width, 0);
      }
    }
  });
});
