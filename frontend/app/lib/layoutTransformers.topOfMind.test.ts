import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, LayoutRuleset } from '@/app/types/index';
import * as dateUtils from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Pins where the "top of mind" tier is actually read from.
 *
 * `taskTier` reads `task.project?.importance` — the relation embedded on each
 * task — not the projects list. That coupling is why the stale-cache bug was
 * visible at all, and why a client patching only the projects list would still
 * render a demoted project in the section. Anything writing importance on the
 * client has to land in both places; these tests are what say so.
 *
 * The golden test can't cover this: its fixtures have exactly one top-of-mind
 * project, already consistent across both sources.
 */

const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(),
    getNow: vi.fn(),
    parseDate: (dateString: string) => new Date(dateString + 'T00:00:00'),
    toISODate: (date: Date) => date.toISOString().split('T')[0],
  };
});

function createProjectMeta(overrides: Partial<Project>): Project {
  return {
    id: 1,
    documentId: 'project-id',
    title: 'Project',
    description: [],
    world: null,
    importance: 'normal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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

// Good Morning's first section, as the seeded view defines it.
const topOfMindRuleset: LayoutRuleset = {
  slug: 'good-morning',
  name: 'good morning',
  layout: 'projects',
  sections: [
    {
      worldMode: 'all',
      worldIds: [],
      importance: 'soonAndTopOfMind',
      projectType: 'any',
      recurrence: 'nonRecurring',
      longOnly: false,
    },
  ],
};

/** A project column whose tasks carry the project relation, as Strapi populates it. */
function column(meta: Project, taskId: string) {
  return { ...meta, tasks: [createTask({ documentId: taskId, project: meta })] };
}

function data(projects: ReturnType<typeof column>[]) {
  return {
    projects,
    categoryGroups: [],
    incidentals: [],
    recurringProjects: [],
    recurringCategoryGroups: [],
    recurringIncidentals: [],
  };
}

/** documentIds of the tasks the section actually rendered. */
function sectionTaskIds(result: ReturnType<typeof transformLayout>): string[] {
  return result
    .projectGroups![0].columns.flatMap((c) => ('tasks' in c ? (c.tasks ?? []) : []))
    .map((t) => t.documentId);
}

describe('good morning — the top of mind tier', () => {
  beforeEach(() => {
    vi.mocked(dateUtils.getToday).mockReturnValue(new Date('2026-06-01T00:00:00'));
    vi.mocked(dateUtils.getNow).mockReturnValue(new Date('2026-06-01T12:00:00'));
  });

  it('shows a single top-of-mind project', () => {
    const promoted = createProjectMeta({ documentId: 'p-new', importance: 'top of mind' });
    const ordinary = createProjectMeta({ documentId: 'p-old', importance: 'normal' });

    const result = transformLayout(
      data([column(promoted, 't-new'), column(ordinary, 't-old')]),
      topOfMindRuleset,
      EST,
      []
    );

    expect(sectionTaskIds(result)).toEqual(['t-new']);
  });

  it('shows BOTH when two projects claim the tier — the shape of the reported bug', () => {
    // Exactly what the user saw: the server had demoted p-old, but the browser
    // still held 'top of mind' on it, so the section rendered two.
    const promoted = createProjectMeta({ documentId: 'p-new', importance: 'top of mind' });
    const staleIncumbent = createProjectMeta({ documentId: 'p-old', importance: 'top of mind' });

    const result = transformLayout(
      data([column(promoted, 't-new'), column(staleIncumbent, 't-old')]),
      topOfMindRuleset,
      EST,
      []
    );

    expect(sectionTaskIds(result)).toEqual(['t-new', 't-old']);
  });

  it("reads importance off the task's project relation, not the projects list", () => {
    // The decisive coupling. Here the column metadata says 'normal' while the
    // task's own relation still says 'top of mind' — the task is rendered in the
    // section anyway. That is why demoting on the client has to patch the task
    // relation too; patching the projects list alone would leave this task lit.
    const listSaysNormal = createProjectMeta({ documentId: 'p-old', importance: 'normal' });
    const relationSaysTopOfMind = createProjectMeta({
      documentId: 'p-old',
      importance: 'top of mind',
    });

    const result = transformLayout(
      data([{ ...listSaysNormal, tasks: [createTask({ documentId: 't-old', project: relationSaysTopOfMind })] }]),
      topOfMindRuleset,
      EST,
      []
    );

    expect(sectionTaskIds(result)).toEqual(['t-old']);
  });

  it('drops a project once both copies say normal', () => {
    const demoted = createProjectMeta({ documentId: 'p-old', importance: 'normal' });

    const result = transformLayout(data([column(demoted, 't-old')]), topOfMindRuleset, EST, []);

    expect(sectionTaskIds(result)).toEqual([]);
  });

  it('keeps a "soon" task regardless of its project importance', () => {
    // The section is soonAndTopOfMind: soon is the other way in, and demoting a
    // project must not evict a task the user marked soon.
    const ordinary = createProjectMeta({ documentId: 'p-old', importance: 'normal' });

    const result = transformLayout(
      data([
        {
          ...ordinary,
          tasks: [createTask({ documentId: 't-soon', project: ordinary, soon: true })],
        },
      ]),
      topOfMindRuleset,
      EST,
      []
    );

    expect(sectionTaskIds(result)).toEqual(['t-soon']);
  });
});
