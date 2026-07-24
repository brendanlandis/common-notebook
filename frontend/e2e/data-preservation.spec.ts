import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import {
  uniqueTitle,
  createProject,
  deleteProject,
  createTask,
  deleteTask,
} from './helpers';

/**
 * Regression suite: no write path may delete data the user did not ask to change.
 *
 * Born from the worldRef-wipe bug — an importance-only PUT sent `worldRef: null`
 * and erased the project's world. Each block creates an entity with its fields and
 * relations populated, runs a PARTIAL write that a form exposes, re-reads via the
 * BFF, and asserts the untouched fields survived.
 *
 * Runs at the request layer on purpose: unintended deletion is a property of the
 * server-side write path (normalizer → route → Strapi), and the UI mutation hooks
 * send exactly these payloads. Everything is created under a unique title and torn
 * down; nothing asserts on fixed fixtures.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function putJson(request: APIRequestContext, url: string, data: Json): Promise<Json> {
  const res = await request.put(url, { data });
  return res.json();
}
async function postJson(request: APIRequestContext, url: string, data: Json): Promise<Json> {
  const res = await request.post(url, { data });
  return res.json();
}
async function findInList(request: APIRequestContext, url: string, documentId: string): Promise<Json> {
  const res = await request.get(url);
  const body = await res.json();
  return (body.data as Json[]).find((row) => row.documentId === documentId);
}

// A non-stuff world to attach projects/sections to (stuff routes a different layout).
async function anyWorldId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/worlds');
  const body = await res.json();
  const world = (body.data ?? []).find((w: Json) => w.systemKey !== 'stuff');
  expect(world, 'this account has no ordinary world to attach to').toBeTruthy();
  return world.documentId;
}

test.describe('data preservation — project', () => {
  test('an importance-only change keeps world, projectType, and title', async ({ request }) => {
    const world = await anyWorldId(request);
    const project = await createProject(request, { world, projectType: 'chores' });

    try {
      const put = await putJson(request, `/api/projects/${project.documentId}`, {
        importance: 'top of mind',
      });
      expect(put.success).toBe(true);
      // The reported bug: this used to come back null.
      expect(put.data.world?.documentId, 'world was wiped by the importance PUT').toBe(world);

      const after = await findInList(request, '/api/projects', project.documentId);
      expect(after.world?.documentId).toBe(world);
      expect(after.projectType).toBe('chores');
      expect(after.title).toBe(project.title);
      expect(after.importance).toBe('top of mind');
    } finally {
      await deleteProject(request, project.documentId);
    }
  });

  test('completing then reviving keeps the world', async ({ request }) => {
    const world = await anyWorldId(request);
    const project = await createProject(request, { world });

    try {
      const completed = await putJson(request, `/api/projects/${project.documentId}`, { complete: true });
      expect(completed.data.world?.documentId, 'world was wiped by completing').toBe(world);

      const revived = await putJson(request, `/api/projects/${project.documentId}`, { complete: false });
      expect(revived.data.world?.documentId, 'world was wiped by reviving').toBe(world);

      const after = await findInList(request, '/api/projects', project.documentId);
      expect(after.world?.documentId).toBe(world);
    } finally {
      await deleteProject(request, project.documentId);
    }
  });
});

test.describe('data preservation — task', () => {
  test('a partial edit keeps the project relation and other scalars', async ({ request }) => {
    const world = await anyWorldId(request);
    const project = await createProject(request, { world });
    const task = await createTask(request, {
      project: project.documentId,
      soon: true,
      long: true,
      dueDate: '2026-08-01',
    });

    try {
      const put = await putJson(request, `/api/tasks/${task.documentId}`, { soon: false });
      expect(put.success).toBe(true);

      const after = await findInList(request, '/api/tasks', task.documentId);
      expect(after.project?.documentId, 'the project relation was dropped by a partial task edit').toBe(
        project.documentId
      );
      expect(after.long).toBe(true);
      expect(after.dueDate).toBe('2026-08-01');
      expect(after.title).toBe(task.title);
      expect(after.soon).toBe(false);
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });

  test('adding a work session keeps the project relation', async ({ request }) => {
    const world = await anyWorldId(request);
    const project = await createProject(request, { world });
    const task = await createTask(request, { project: project.documentId, long: true });

    try {
      const put = await postJson(request, `/api/tasks/${task.documentId}/work-session`, {});
      expect(put.success).toBe(true);
      expect(put.data.project?.documentId, 'work-session write dropped the project relation').toBe(
        project.documentId
      );

      const after = await findInList(request, '/api/tasks', task.documentId);
      expect(after.project?.documentId).toBe(project.documentId);
      expect((after.workSessions ?? []).length).toBeGreaterThan(0);
    } finally {
      await deleteTask(request, task.documentId);
      await deleteProject(request, project.documentId);
    }
  });
});

test.describe('data preservation — view (component sections)', () => {
  const sectionA = (worldId: string) => ({
    name: 'A',
    worldMode: 'except' as const,
    worlds: [worldId],
    importance: 'soonAndTopOfMind' as const,
    projectType: 'any' as const,
    recurrence: 'nonRecurring' as const,
    longOnly: false,
  });
  const sectionB = {
    name: 'B',
    worldMode: 'all' as const,
    worlds: [] as string[],
    importance: 'regular' as const,
    projectType: 'chores' as const,
    recurrence: 'both' as const,
    longOnly: true,
  };

  async function createView(request: APIRequestContext, worldId: string): Promise<string> {
    const body = await postJson(request, '/api/views', {
      name: uniqueTitle('view'),
      layout: 'projects',
      position: 999,
      sections: [sectionA(worldId), sectionB],
    });
    expect(body.success, `createView failed: ${JSON.stringify(body)}`).toBe(true);
    return body.data.documentId;
  }
  const deleteView = (request: APIRequestContext, id: string) =>
    request.delete(`/api/views/${id}`).catch(() => {});

  // Compare a fetched section against an expected input (worlds → documentIds).
  function sectionMatches(fetched: Json, expected: ReturnType<typeof sectionA> | typeof sectionB) {
    return {
      name: fetched.name,
      worldMode: fetched.worldMode,
      worlds: (fetched.worlds ?? []).map((w: Json) => w.documentId),
      importance: fetched.importance,
      projectType: fetched.projectType,
      recurrence: fetched.recurrence,
      longOnly: fetched.longOnly,
    };
  }

  test('renaming a view leaves both sections and all their fields intact', async ({ request }) => {
    const world = await anyWorldId(request);
    const viewId = await createView(request, world);

    try {
      const put = await putJson(request, `/api/views/${viewId}`, { name: 'renamed view' });
      expect(put.success).toBe(true);

      const after = await findInList(request, '/api/views', viewId);
      expect(after.name).toBe('renamed view');
      expect(after.sections).toHaveLength(2);
      expect(sectionMatches(after.sections[0], sectionA(world))).toEqual({
        name: 'A',
        worldMode: 'except',
        worlds: [world],
        importance: 'soonAndTopOfMind',
        projectType: 'any',
        recurrence: 'nonRecurring',
        longOnly: false,
      });
      expect(sectionMatches(after.sections[1], sectionB)).toEqual({
        name: 'B',
        worldMode: 'all',
        worlds: [],
        importance: 'regular',
        projectType: 'chores',
        recurrence: 'both',
        longOnly: true,
      });
    } finally {
      await deleteView(request, viewId);
    }
  });

  test('editing one section leaves the sibling section untouched', async ({ request }) => {
    const world = await anyWorldId(request);
    const viewId = await createView(request, world);

    try {
      // Change only section A's importance; resend both (replace-on-write).
      await putJson(request, `/api/views/${viewId}`, {
        sections: [{ ...sectionA(world), importance: 'later' }, sectionB],
      });

      const after = await findInList(request, '/api/views', viewId);
      expect(after.sections).toHaveLength(2);
      expect(after.sections[0].importance).toBe('later');
      // Sibling B must be byte-for-byte unchanged.
      expect(sectionMatches(after.sections[1], sectionB)).toEqual({
        name: 'B',
        worldMode: 'all',
        worlds: [],
        importance: 'regular',
        projectType: 'chores',
        recurrence: 'both',
        longOnly: true,
      });
    } finally {
      await deleteView(request, viewId);
    }
  });
});

test.describe('data preservation — world', () => {
  test('renaming a world keeps its position', async ({ request }) => {
    const created = await postJson(request, '/api/worlds', {
      title: uniqueTitle('world'),
      position: 987,
    });
    expect(created.success, `createWorld failed: ${JSON.stringify(created)}`).toBe(true);
    const id = created.data.documentId;

    try {
      await putJson(request, `/api/worlds/${id}`, { title: 'renamed world' });

      const after = await findInList(request, '/api/worlds', id);
      expect(after.title).toBe('renamed world');
      expect(after.position, 'position was lost on rename').toBe(987);
    } finally {
      await request.delete(`/api/worlds/${id}`).catch(() => {});
    }
  });
});

test.describe('data preservation — practice log', () => {
  test('saving notes keeps type, duration, and date', async ({ request }) => {
    const created = await postJson(request, '/api/practice-logs', {
      type: 'guitar',
      duration: 42,
      date: '2026-08-01',
      start: '2026-08-01T10:00:00.000Z',
    });
    expect(created.success, `createPracticeLog failed: ${JSON.stringify(created)}`).toBe(true);
    const id = created.data.documentId;

    try {
      await putJson(request, `/api/practice-logs/${id}`, {
        notes: [{ type: 'paragraph', children: [{ type: 'text', text: 'worked on scales' }] }],
      });

      const after = await findInList(request, '/api/practice-logs', id);
      expect(after.type).toBe('guitar');
      expect(after.duration).toBe(42);
      expect(after.date).toBe('2026-08-01');
    } finally {
      await request.delete(`/api/practice-logs/${id}`).catch(() => {});
    }
  });
});

// system-settings is intentionally not exercised here: its PUT is an upsert keyed
// by `title` with a conditional field spread (app/api/system-settings/route.ts) —
// it has no relations or components and never writes a field the caller omitted,
// and separate settings live in separate rows, so there is nothing for a partial
// write to clobber. Adding a test would also pollute the real settings namespace.
