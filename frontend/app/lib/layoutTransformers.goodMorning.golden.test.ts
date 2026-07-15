import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, LayoutRuleset, World } from '@/app/types/index';
import * as dateUtils from './dateUtils';

// GOLDEN TEST — pins the CURRENT good-morning output so the composable-views
// refactor can reproduce it. When good-morning becomes a seeded data view, the
// only thing that should change in this file is how `goodMorningRuleset` is
// built (preset -> viewToRuleset of the seeded view); the snapshots must stay
// identical. See ~/.claude/plans/read-the-plan-at-dynamic-hartmanis.md.
//
// Captured behaviors:
//  - Recurring section excludes day-job (includeInCombinedViews === false) worlds.
//  - Soon + top-of-mind section pulls soon tasks AND all tasks of the top-of-mind
//    project from EVERY world (day job included), no day-job filter.
//  - Future displayDate tasks are hidden.
//  - Incidentals asymmetry: soon (no-world) incidentals show; recurring (no-world)
//    incidentals do NOT (combined scope drops no-world tasks from the recurring pass).

const musicWorld: World = {
  id: 1,
  documentId: 'w-music',
  title: 'make music',
  slug: 'make-music',
  position: 0,
  systemKey: null,
  includeInCombinedViews: true,
};

const dayJobWorld: World = {
  id: 2,
  documentId: 'w-dayjob',
  title: 'day job',
  slug: 'day-job',
  position: 1,
  systemKey: null,
  includeInCombinedViews: false,
};

vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getTodayInEST: vi.fn(),
    getNowInEST: vi.fn(),
    parseInEST: (dateString: string) => new Date(dateString + 'T00:00:00'),
    toISODateInEST: (date: Date) => date.toISOString().split('T')[0],
  };
});

vi.mock('./timezoneConfig', () => ({
  getTimezone: vi.fn(() => 'America/New_York'),
  getDayBoundaryHour: vi.fn(() => 0),
}));

function createTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    documentId: 'task-id',
    title: 'Test task',
    description: [],
    completed: false,
    completedAt: null,
    dueDate: null,
    displayDate: null,
    displayDateOffset: null,
    isRecurring: false,
    recurrenceType: 'none',
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    project: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createProject(overrides: Partial<Project>): Project {
  return {
    id: 1,
    documentId: 'project-id',
    title: 'Project',
    description: [],
    world: musicWorld,
    importance: 'normal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tasks: [],
    ...overrides,
  };
}

const goodMorningRuleset: LayoutRuleset = {
  id: 'good-morning',
  name: 'good morning',
  showRecurring: true,
  showNonRecurring: true,
  worldScope: 'combined',
  sortBy: 'creationDate',
  groupBy: 'good-morning',
};

// Project columns split across the recurring / non-recurring raw arrays exactly
// how buildRawTaskData splits a project's tasks. Each task carries its own
// `project` (with world) — the transformer's world gate reads task.project.world,
// not the containing section — mirroring the populated Strapi relation.
function makeProject(
  opts: Pick<Project, 'documentId' | 'title' | 'world' | 'importance' | 'createdAt'>,
  tasks: Task[]
): Project {
  const ref = createProject({ ...opts, tasks: [] });
  return { ...ref, tasks: tasks.map((t) => ({ ...t, project: ref })) };
}
const albumTom = (tasks: Task[]) =>
  makeProject({ documentId: 'p-album', title: 'Album', world: musicWorld, importance: 'top of mind', createdAt: '2026-01-01T00:00:00.000Z' }, tasks);
const work = (tasks: Task[]) =>
  makeProject({ documentId: 'p-work', title: 'Work', world: dayJobWorld, importance: 'normal', createdAt: '2026-01-02T00:00:00.000Z' }, tasks);
const band = (tasks: Task[]) =>
  makeProject({ documentId: 'p-band', title: 'Band', world: musicWorld, importance: 'normal', createdAt: '2026-01-03T00:00:00.000Z' }, tasks);

function goldenData() {
  return {
    // non-recurring project columns (read raw by the soon + top-of-mind pass)
    projects: [
      albumTom([
        createTask({ documentId: 't-mix', title: 'mix', createdAt: '2026-01-05T00:00:00.000Z' }),
        createTask({ documentId: 't-master', title: 'master', createdAt: '2026-01-06T00:00:00.000Z' }),
      ]),
      work([
        createTask({ documentId: 't-reply', title: 'reply to boss', soon: true, createdAt: '2026-01-07T00:00:00.000Z' }),
        createTask({ documentId: 't-file', title: 'file report', createdAt: '2026-01-08T00:00:00.000Z' }),
      ]),
      band([
        createTask({ documentId: 't-show', title: 'book show', soon: true, createdAt: '2026-01-09T00:00:00.000Z' }),
        createTask({ documentId: 't-strings', title: 'buy strings', createdAt: '2026-01-10T00:00:00.000Z' }),
        createTask({ documentId: 't-future', title: 'future thing', soon: true, displayDate: '2026-07-01', createdAt: '2026-01-11T00:00:00.000Z' }),
      ]),
    ],
    categoryGroups: [],
    incidentals: [
      createTask({ documentId: 't-callmom', title: 'call mom', soon: true, createdAt: '2026-01-12T00:00:00.000Z' }),
    ],
    // recurring project columns
    recurringProjects: [
      band([createTask({ documentId: 't-practice', title: 'practice', isRecurring: true, recurrenceType: 'daily', createdAt: '2026-01-04T00:00:00.000Z' })]),
      work([createTask({ documentId: 't-standup', title: 'daily standup', isRecurring: true, recurrenceType: 'daily', createdAt: '2026-01-04T00:00:00.000Z' })]),
    ],
    recurringCategoryGroups: [],
    recurringIncidentals: [
      createTask({ documentId: 't-water', title: 'water plants', isRecurring: true, recurrenceType: 'weekly', createdAt: '2026-01-13T00:00:00.000Z' }),
    ],
  };
}

// Project | TaskGroup -> a readable { key, taskIds } projection.
function projectSections(sections: unknown[] | undefined) {
  if (!sections) return undefined;
  return (sections as Array<Record<string, unknown>>).map((s) => ({
    key: 'documentId' in s ? (s.documentId as string) : (s.title as string),
    tasks: ((s.tasks as Task[]) ?? []).map((t) => t.documentId),
  }));
}

function projectIncidentals(tasks: Task[] | undefined) {
  return tasks ? tasks.map((t) => t.documentId) : undefined;
}

describe('good-morning golden output', () => {
  beforeEach(() => {
    vi.mocked(dateUtils.getTodayInEST).mockReturnValue(new Date('2026-06-01T00:00:00'));
    vi.mocked(dateUtils.getNowInEST).mockReturnValue(new Date('2026-06-01T12:00:00'));
  });

  it('produces the expected sections + incidentals', () => {
    const result = transformLayout(goldenData(), goodMorningRuleset, [musicWorld, dayJobWorld]);

    const projection = {
      combinedSections: projectSections(result.combinedSections),
      combinedIncidentals: projectIncidentals(result.combinedIncidentals),
      topOfMindSections: projectSections(result.topOfMindSections),
      topOfMindIncidentals: projectIncidentals(result.topOfMindIncidentals),
    };

    expect(projection).toMatchInlineSnapshot(`
      {
        "combinedIncidentals": undefined,
        "combinedSections": [
          {
            "key": "p-band",
            "tasks": [
              "t-practice",
            ],
          },
        ],
        "topOfMindIncidentals": [
          "t-callmom",
        ],
        "topOfMindSections": [
          {
            "key": "p-album",
            "tasks": [
              "t-mix",
              "t-master",
            ],
          },
          {
            "key": "p-work",
            "tasks": [
              "t-reply",
            ],
          },
          {
            "key": "p-band",
            "tasks": [
              "t-show",
            ],
          },
        ],
      }
    `);
  });
});
