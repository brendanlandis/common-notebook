import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// These tests run against the `brendan` account on the local sqlite copy, so they
// can't assert on fixed seed fixtures — each spec creates what it needs under a
// unique title and deletes it again. Setup goes through the BFF routes rather than
// the UI: faster, and a failure there is a broken fixture, not a failed assertion.

export const E2E_PREFIX = '[e2e]';

let counter = 0;
export function uniqueTitle(what: string): string {
  counter += 1;
  return `${E2E_PREFIX} ${what} ${Date.now()}-${counter}`;
}

interface CreatedProject {
  documentId: string;
  title: string;
  slug: string;
}

export async function createProject(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<CreatedProject> {
  const title = (overrides.title as string) ?? uniqueTitle('project');
  const slug = `e2e-${Date.now()}-${++counter}`;
  const res = await request.post('/api/projects', {
    data: {
      title,
      slug,
      importance: 'normal',
      // 'default' is projectType's ordinary value; 'normal' is importance's.
      // Sending 'normal' here is the 400 that hid for months.
      projectType: 'default',
      ...overrides,
    },
  });
  const body = await res.json();
  expect(body.success, `createProject failed: ${JSON.stringify(body)}`).toBe(true);
  return { documentId: body.data.documentId, title, slug: body.data.slug };
}

interface CreatedTask {
  documentId: string;
  title: string;
}

export async function createTask(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<CreatedTask> {
  const title = (overrides.title as string) ?? uniqueTitle('task');
  const res = await request.post('/api/tasks', {
    data: { title, recurrenceType: 'none', ...overrides },
  });
  const body = await res.json();
  expect(body.success, `createTask failed: ${JSON.stringify(body)}`).toBe(true);
  return { documentId: body.data.documentId, title };
}

// Cleanup is best-effort: a leaked row on a disposable database is harmless, and a
// throw here would mask the real assertion failure that skipped the delete.
export async function deleteTask(request: APIRequestContext, documentId: string) {
  await request.delete(`/api/tasks/${documentId}`).catch(() => {});
}

export async function deleteProject(request: APIRequestContext, documentId: string) {
  await request.delete(`/api/projects/${documentId}`).catch(() => {});
}

// Deletes every task whose title starts with the given text — a recurring task
// spawns a next occurrence whose documentId the test never learns.
export async function deleteTasksByTitle(request: APIRequestContext, title: string) {
  const res = await request.get('/api/tasks');
  const body = await res.json().catch(() => ({ success: false }));
  if (!body.success) return;
  const matches = (body.data as Array<{ documentId: string; title: string }>).filter((t) =>
    t.title.startsWith(title)
  );
  for (const t of matches) await deleteTask(request, t.documentId);
}

// /todo renders `<p>loading...</p>` from two sequential gates (views, then tasks),
// so waiting for that text to detach can pass in the gap between them. Wait for a
// positive signal instead.
// A view can render more than one `.tasks-container`, so this narrows to the first
// match — an unnarrowed locator trips Playwright's strict mode instead of waiting.
export async function gotoTodo(page: Page, path = '/todo') {
  await page.goto(path);
  const ready = page
    .locator('.tasks-container, p:has-text("nothin\' to do, nowhere to be")')
    .first();
  await expect(ready).toBeVisible({ timeout: 30_000 });
}

// Tests anchor on a project's own view rather than /todo. The default view is
// whatever the account has at position 0 (a filtered `projects` layout for
// brendan), so a freshly created task may legitimately not appear there — but a
// project view always lists its own tasks, whatever the view config.
//
// Address it by documentId, not slug: the page resolves either, and saving the
// project form rewrites the slug from the title (the #slug field is read-only and
// derived), which would strand a slug-based URL mid-test.
export async function gotoProject(page: Page, documentId: string) {
  await page.goto(`/todo/project/${documentId}`);
  await expect(page.locator('.project-view-header h1')).toBeVisible({ timeout: 30_000 });
}

// The row for a task, scoped by id — every row repeats the same aria-labels.
export function taskRow(page: Page, documentId: string) {
  return page.locator(`li:has(#task-${documentId})`);
}

// Whether Strapi actually recorded the completion. Asserting this via the UI is
// not possible on every account: `completedTaskVisibilityMinutes` is 0 on some
// (brendan's included), which correctly drops a completed task from the list the
// instant it's completed. This asks the server directly instead.
export async function isCompletedOnServer(
  request: APIRequestContext,
  documentId: string
): Promise<boolean> {
  const res = await request.get('/api/tasks/completed?days=1');
  const body = await res.json();
  if (!body.success) return false;
  return (body.data as Array<{ documentId: string }>).some((t) => t.documentId === documentId);
}
