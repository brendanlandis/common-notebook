import { test, expect } from '@playwright/test';
import { createProject, deleteProject, gotoProject } from './helpers';

// The test that would have caught the `projectType` bug. ProjectForm sent
// projectType:'normal' (importance's ordinary value; projectType's is 'default'),
// Strapi 400'd the enum, and nobody noticed for months — because
// handleProjectFormSubmit closes the drawer *before* awaiting and only
// console.error's on failure, so a rejected save looks exactly like a success.
//
// Hence the reload: without it, this test would have passed on the broken code.

async function openProjectForm(page: import('@playwright/test').Page) {
  await page.getByLabel('edit project').click();
  await expect(page.locator('form.project-form')).toBeVisible();
}

// Submitting is fire-and-forget: handleProjectFormSubmit closes the drawer before
// awaiting the PUT. Navigating straight after the click therefore cancels the
// in-flight request — so wait for the response before leaving the page.
async function saveProjectForm(page: import('@playwright/test').Page) {
  const saved = page.waitForResponse(
    (res) => /\/api\/projects\/[^/]+$/.test(res.url()) && res.request().method() === 'PUT'
  );
  await page.getByRole('button', { name: 'update project' }).click();
  return saved;
}

test.describe('project edit', () => {
  test('a projectType change persists', async ({ page, request }) => {
    const project = await createProject(request);

    try {
      await gotoProject(page, project.documentId);
      await openProjectForm(page);
      // projectType is no longer a select — the form offers a `chores` checkbox
      // and derives the value (`chores ? 'chores' : 'default'`). The thing under
      // test is unchanged: that what the form sends is a valid enum member and
      // that it survives a round trip.
      await expect(page.locator('#chores')).not.toBeChecked();

      await page.locator('#chores').check();
      const saved = await saveProjectForm(page);
      expect(saved.status(), 'the projectType save was rejected').toBeLessThan(400);

      // Reload before asserting: the drawer closes optimistically, so the only
      // honest proof the save landed is re-reading it from the server.
      await gotoProject(page, project.documentId);
      await openProjectForm(page);
      await expect(page.locator('#chores')).toBeChecked();
    } finally {
      await deleteProject(request, project.documentId);
    }
  });

  test('an ordinary project saves as default, never normal', async ({ page, request }) => {
    const project = await createProject(request);
    const rejected: string[] = [];
    page.on('response', async (res) => {
      if (res.url().includes('/api/projects') && res.status() >= 400) {
        rejected.push(`${res.status()} ${res.url()}`);
      }
    });

    try {
      await gotoProject(page, project.documentId);
      await openProjectForm(page);

      // Touch only the title and save. This is the exact path that used to send
      // projectType:'normal' and get `400 projectType must be one of ...`.
      await page.locator('#title').fill(`${project.title} edited`);
      await saveProjectForm(page);

      await gotoProject(page, project.documentId);
      await openProjectForm(page);
      await expect(page.locator('#chores')).not.toBeChecked();
      // The real assertion of this test: nothing 400'd. An unchecked box has to
      // mean projectType 'default' — 'normal' is importance's ordinary value and
      // is not in the enum, which is the bug that hid for months behind a drawer
      // that closed before awaiting.
      expect(rejected, 'the save was rejected by the API').toEqual([]);
    } finally {
      await deleteProject(request, project.documentId);
    }
  });
});
