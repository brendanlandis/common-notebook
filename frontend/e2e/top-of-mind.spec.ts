import { test, expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { createProject, createTask, deleteProject, deleteTask, gotoTodo } from './helpers';

/**
 * The reported bug: with one project already "top of mind", promoting a second
 * showed BOTH in Good Morning until a reload.
 *
 * The invariant was never broken in the database — the route demotes the
 * incumbent correctly. It broke in the browser: the demotion happens under a
 * request naming only the promoted project, so the client patched that one row
 * and left the incumbent's stale 'top of mind' in the cache, in both the
 * projects list and the `project` relation embedded on its tasks.
 *
 * Nothing below reloads before asserting, and that is the entire point. A
 * `page.goto` would refetch and paper over the defect — which is exactly why the
 * bug reads as "until I reload". `staleTime` is 30s with refetchOnWindowFocus,
 * so the stale render also heals on its own if you leave and come back; the
 * assertions here run immediately after the save for that reason.
 */

const TOP_OF_MIND_SECTION = 'top of mind';

/**
 * A project needs a world to render as a *column*.
 *
 * `getTaskWorld` reads `task.project.world`, and a task without one is treated
 * as an incidental — it still appears, but with no column header, so no "edit
 * project" button to click. Resolved at runtime rather than hardcoded: worlds
 * are per-user rows, and the ids differ per account.
 */
async function anyWorldId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/worlds');
  const body = await res.json();
  const worlds = (body.data ?? []) as Array<{ documentId: string; systemKey: string | null }>;
  // The stuff world routes projects through a different layout entirely.
  const world = worlds.find((w) => w.systemKey !== 'stuff');
  expect(world, 'this account has no ordinary world to attach a project to').toBeTruthy();
  return world!.documentId;
}

/** The Good Morning group whose heading is "top of mind". */
function topOfMindSection(page: Page) {
  return page.locator('.group-section', {
    has: page.locator('h2', { hasText: TOP_OF_MIND_SECTION }),
  });
}

/** The pencil in a given project's column header. */
function editProjectButton(page: Page, projectTitle: string) {
  return page
    .locator('h3')
    .filter({ hasText: projectTitle })
    .getByLabel('edit project');
}

/**
 * Submitting is fire-and-forget — handleProjectFormSubmit closes the drawer
 * before awaiting the PUT — so wait for the response rather than the drawer.
 */
async function promoteViaForm(page: Page, projectTitle: string) {
  await editProjectButton(page, projectTitle).click();
  await expect(page.locator('form.project-form')).toBeVisible();

  const saved = page.waitForResponse(
    (res) => /\/api\/projects\/[^/]+$/.test(res.url()) && res.request().method() === 'PUT'
  );
  await page.locator('#importance').selectOption('top of mind');
  await page.getByRole('button', { name: 'update project' }).click();
  return saved;
}

test.describe('top of mind', () => {
  test('promoting a project drops the previous one from the section, without a reload', async ({
    page,
    request,
  }) => {
    // A holds the slot. B is ordinary, but its task is `soon`, which is the
    // section's other entry condition — that puts B's column on the same page so
    // its edit button is reachable without navigating away.
    const world = await anyWorldId(request);
    const incumbent = await createProject(request, { importance: 'top of mind', world });
    const challenger = await createProject(request, { world });
    const incumbentTask = await createTask(request, { project: incumbent.documentId });
    const challengerTask = await createTask(request, {
      project: challenger.documentId,
      soon: true,
    });

    try {
      await gotoTodo(page, '/todo/view/good-morning');
      const section = topOfMindSection(page);

      // Precondition: the incumbent is in the section because it is top of mind.
      await expect(section.locator(`li:has(#task-${incumbentTask.documentId})`)).toBeVisible();
      await expect(section.locator(`li:has(#task-${challengerTask.documentId})`)).toBeVisible();

      const saved = await promoteViaForm(page, challenger.title);
      expect(saved.status(), 'the promotion was rejected').toBeLessThan(400);

      // The assertion. No reload: the incumbent must leave the section on the
      // strength of what the response told the client. Before the fix both rows
      // stayed and this timed out.
      await expect(
        section.locator(`li:has(#task-${incumbentTask.documentId})`),
        'the demoted project is still in "top of mind" — the client never heard about its demotion'
      ).toBeHidden();

      // The promoted one stays, so this is not just "everything vanished".
      await expect(section.locator(`li:has(#task-${challengerTask.documentId})`)).toBeVisible();
    } finally {
      await deleteTask(request, incumbentTask.documentId);
      await deleteTask(request, challengerTask.documentId);
      await deleteProject(request, incumbent.documentId);
      await deleteProject(request, challenger.documentId);
    }
  });

  test('the demotion is real: a reload agrees with what was shown', async ({ page, request }) => {
    // Guards the opposite failure — a client-only patch that looks right but
    // never reached the database.
    const world = await anyWorldId(request);
    const incumbent = await createProject(request, { importance: 'top of mind', world });
    const challenger = await createProject(request, { world });
    const incumbentTask = await createTask(request, { project: incumbent.documentId });
    const challengerTask = await createTask(request, {
      project: challenger.documentId,
      soon: true,
    });

    try {
      await gotoTodo(page, '/todo/view/good-morning');
      await expect(
        topOfMindSection(page).locator(`li:has(#task-${incumbentTask.documentId})`)
      ).toBeVisible();

      await promoteViaForm(page, challenger.title);
      await expect(
        topOfMindSection(page).locator(`li:has(#task-${incumbentTask.documentId})`)
      ).toBeHidden();

      // Re-read from the server.
      await gotoTodo(page, '/todo/view/good-morning');
      await expect(
        topOfMindSection(page).locator(`li:has(#task-${challengerTask.documentId})`)
      ).toBeVisible();
      await expect(
        topOfMindSection(page).locator(`li:has(#task-${incumbentTask.documentId})`)
      ).toBeHidden();
    } finally {
      await deleteTask(request, incumbentTask.documentId);
      await deleteTask(request, challengerTask.documentId);
      await deleteProject(request, incumbent.documentId);
      await deleteProject(request, challenger.documentId);
    }
  });

  test('only one project is top of mind on the server afterwards', async ({ page, request }) => {
    // Requirement #2, asserted against the API rather than the DOM. Scoped to
    // this account by the caller's token — the ownership middleware is what
    // keeps it from touching anyone else's rows, and a single-account e2e cannot
    // observe that directly.
    const world = await anyWorldId(request);
    const incumbent = await createProject(request, { importance: 'top of mind', world });
    const challenger = await createProject(request, { world });
    const challengerTask = await createTask(request, {
      project: challenger.documentId,
      soon: true,
    });

    try {
      await gotoTodo(page, '/todo/view/good-morning');
      await promoteViaForm(page, challenger.title);

      const res = await request.get('/api/projects');
      const body = await res.json();
      const mine = (body.data as Array<{ documentId: string; importance: string }>).filter((p) =>
        [incumbent.documentId, challenger.documentId].includes(p.documentId)
      );

      expect(mine.find((p) => p.documentId === challenger.documentId)?.importance).toBe(
        'top of mind'
      );
      expect(mine.find((p) => p.documentId === incumbent.documentId)?.importance).toBe('normal');
    } finally {
      await deleteTask(request, challengerTask.documentId);
      await deleteProject(request, incumbent.documentId);
      await deleteProject(request, challenger.documentId);
    }
  });
});
