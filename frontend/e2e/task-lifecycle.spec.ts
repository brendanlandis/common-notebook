import { test, expect } from '@playwright/test';
import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  gotoProject,
  isCompletedOnServer,
  taskRow,
} from './helpers';

// Complete and uncomplete hit two different endpoints (POST /complete vs
// PUT {completed:false}), and the checkbox is local state in TaskItem — so this
// is the flow most likely to regress when handleComplete becomes an optimistic
// mutation in Stage 5.

test.describe('task lifecycle', () => {
  test('a task can be completed and uncompleted', async ({ page, request }) => {
    const project = await createProject(request);
    const task = await createTask(request, { project: project.documentId });

    try {
      await gotoProject(page, project.documentId);

      const row = taskRow(page, task.documentId);
      await expect(row).toBeVisible();
      // A completed row fades (opacity .3) and stays put; it does not move
      // section, and does not gain a strikethrough (that's `worked-on`).
      await expect(row).not.toHaveClass(/completed/);

      const checkbox = page.locator(`#task-${task.documentId}`);
      await checkbox.check();
      await expect(row).toHaveClass(/completed/);

      await checkbox.uncheck();
      await expect(row).not.toHaveClass(/completed/);
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });

  // The checkbox is local state in TaskItem, flipped on click before anything is
  // known about the request. The old handler returned early on a non-ok response
  // without reverting, so a rejected complete left the box ticked and lying until
  // something else happened to refetch. onMutate/onError now put it back.
  test('a rejected complete rolls the checkbox back', async ({ page, request }) => {
    const project = await createProject(request);
    const task = await createTask(request, { project: project.documentId });

    try {
      await gotoProject(page, project.documentId);
      const row = taskRow(page, task.documentId);
      const checkbox = page.locator(`#task-${task.documentId}`);

      // A 500 rather than an abort: an aborted request throws, and the old code's
      // catch refetched, which hid the missing rollback. This is the real hole.
      await page.route('**/api/tasks/*/complete', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'boom' }),
        })
      );

      await checkbox.check();

      await expect(checkbox).not.toBeChecked();
      await expect(row).not.toHaveClass(/completed/);
      expect(await isCompletedOnServer(request, task.documentId)).toBe(false);
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });

  test('completing a task persists to the server', async ({ page, request }) => {
    const project = await createProject(request);
    const task = await createTask(request, { project: project.documentId });

    try {
      await gotoProject(page, project.documentId);
      await expect(await isCompletedOnServer(request, task.documentId)).toBe(false);

      await page.locator(`#task-${task.documentId}`).check();
      await expect(taskRow(page, task.documentId)).toHaveClass(/completed/);

      // The checkbox is local state and flips whether or not the write lands, so
      // the UI alone can't prove this. Ask the server.
      await expect
        .poll(() => isCompletedOnServer(request, task.documentId), { timeout: 10_000 })
        .toBe(true);
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });
});
