import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, LayoutRuleset, World } from '@/app/types/index';
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

// Mock only the clock (getToday). parseDate/toISODate run for real — the old
// stubs lied for any positive UTC offset and hid the real conversion.
vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(),
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
    vi.mocked(dateUtils.getToday).mockReturnValue(dateUtils.parseDate('2026-06-01', EST));
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

describe('good morning — a world-less top-of-mind project', () => {
  // A project marked "top of mind" but assigned no world isn't placed by world
  // scoping, so under any worldMode except "all" it used to vanish. In a dedicated
  // top-of-mind section it must surface anyway — but that exemption must not leak
  // into ordinary world-scoped views, and a top-of-mind project that DOES have an
  // excluded world stays filtered.
  beforeEach(() => {
    vi.mocked(dateUtils.getToday).mockReturnValue(dateUtils.parseDate('2026-06-01', EST));
  });

  const world = (documentId: string, title: string): World => ({
    id: documentId === 'w-dayjob' ? 4 : 2,
    documentId,
    title,
    slug: title.replace(/\s+/g, '-'),
    position: 0,
    systemKey: null,
  });
  const dayJob = world('w-dayjob', 'day job');
  const computer = world('w-computer', 'computer');
  const worlds = [dayJob, computer];

  const topOfMindSection = (worldMode: 'all' | 'only' | 'except', worldIds: string[]): LayoutRuleset => ({
    slug: 'good-morning',
    name: 'good morning',
    layout: 'projects',
    sections: [
      { worldMode, worldIds, importance: 'soonAndTopOfMind', projectType: 'any', recurrence: 'nonRecurring', longOnly: false },
    ],
  });

  const worldlessTopOfMind = createProjectMeta({ documentId: 'p-cn', importance: 'top of mind', world: null });

  it('appears under an "except [day job]" top-of-mind section', () => {
    const result = transformLayout(
      data([column(worldlessTopOfMind, 't-cn')]),
      topOfMindSection('except', ['w-dayjob']),
      EST,
      worlds
    );
    expect(sectionTaskIds(result)).toEqual(['t-cn']);
  });

  it('appears under an "only [computer]" top-of-mind section', () => {
    const result = transformLayout(
      data([column(worldlessTopOfMind, 't-cn')]),
      topOfMindSection('only', ['w-computer']),
      EST,
      worlds
    );
    expect(sectionTaskIds(result)).toEqual(['t-cn']);
  });

  it('does NOT leak into an ordinary world-scoped view (importance "any", only [computer])', () => {
    const anyImportanceView: LayoutRuleset = {
      slug: 'computer',
      name: 'computer',
      layout: 'projects',
      sections: [
        { worldMode: 'only', worldIds: ['w-computer'], importance: 'any', projectType: 'any', recurrence: 'nonRecurring', longOnly: false },
      ],
    };
    const result = transformLayout(data([column(worldlessTopOfMind, 't-cn')]), anyImportanceView, EST, worlds);
    expect(sectionTaskIds(result)).toEqual([]);
  });

  it('does NOT appear in a "regular" tier section', () => {
    const regularSection: LayoutRuleset = {
      slug: 'x',
      name: 'x',
      layout: 'projects',
      sections: [
        { worldMode: 'all', worldIds: [], importance: 'regular', projectType: 'any', recurrence: 'nonRecurring', longOnly: false },
      ],
    };
    const result = transformLayout(data([column(worldlessTopOfMind, 't-cn')]), regularSection, EST, worlds);
    expect(sectionTaskIds(result)).toEqual([]);
  });

  it('leaves a top-of-mind project WITH an excluded world filtered out', () => {
    const dayJobTopOfMind = createProjectMeta({ documentId: 'p-dj', importance: 'top of mind', world: dayJob });
    const result = transformLayout(
      data([column(dayJobTopOfMind, 't-dj')]),
      topOfMindSection('except', ['w-dayjob']),
      EST,
      worlds
    );
    expect(sectionTaskIds(result)).toEqual([]);
  });
});
