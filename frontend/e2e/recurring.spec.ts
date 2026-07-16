import { test, expect } from '@playwright/test';
import { createProject, deleteProject, deleteTasksByTitle, gotoProject } from './helpers';

// Completing a recurring task makes the server create the next occurrence and
// hand it back as `newTask`, which the client splices into the list. Stage 5
// moves that splice into a mutation's onSuccess, so this pins the behaviour.
//
// What this deliberately does NOT assert: that two rows appear. A daily task's
// next occurrence has displayDate = tomorrow, so it correctly does not render
// today — and the completed original disappears immediately on any account whose
// completedTaskVisibilityMinutes is 0. The observable truth is on the server.

test.describe('recurring tasks', () => {
  test('completing one creates the next occurrence', async ({ page, request }) => {
    const project = await createProject(request);
    const title = `[e2e] recurring ${Date.now()}`;

    const created = await request.post('/api/tasks', {
      data: {
        title,
        recurrenceType: 'daily',
        isRecurring: true,
        project: project.documentId,
      },
    });
    const originalId = (await created.json()).data.documentId;

    try {
      await gotoProject(page, project.documentId);
      await expect(page.locator(`#task-${originalId}`)).toBeVisible();

      // Complete it through the UI — the point is that the browser flow triggers
      // the server-side recurrence, not just that the endpoint works.
      await page.locator(`#task-${originalId}`).check();

      const findNextOccurrence = async () => {
        const res = await request.get('/api/tasks');
        const body = await res.json();
        if (!body.success) return null;
        return (
          (body.data as Array<Record<string, unknown>>).find(
            (t) => t.title === title && t.documentId !== originalId
          ) ?? null
        );
      };

      await expect
        .poll(findNextOccurrence, { timeout: 15_000, message: 'no next occurrence was created' })
        .not.toBeNull();

      const occurrence = (await findNextOccurrence())!;
      expect(occurrence.completed).toBe(false);
      expect(occurrence.isRecurring).toBe(true);
      // Scheduled forward rather than left dateless. The exact date is day-boundary
      // and timezone math — that belongs to the recurrence unit tests, not here.
      expect(occurrence.displayDate).not.toBeNull();
    } finally {
      await deleteTasksByTitle(request, title);
      await deleteProject(request, project.documentId);
    }
  });
});
