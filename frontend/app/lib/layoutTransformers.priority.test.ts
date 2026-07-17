import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, LayoutRuleset, World } from '@/app/types/index';
import * as dateUtils from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

// The timezone and day boundary are parameters now; these tests pin them.
const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

const world: World = {
  id: 1,
  documentId: 'w-1',
  title: 'make music',
  slug: 'make-music',
  position: 0,
  systemKey: null,
};

// Mock only the clock (getToday). parseDate/toISODate run for real — the old
// stubs (machine-local midnight + a UTC-component reader) lied for any positive
// UTC offset and hid the real conversion.
vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(),
  };
});


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

// A project with one task that carries the project back-reference (with world),
// as the useTasks overlay produces in the app.
function makeProject(overrides: Partial<Project> & { documentId: string; title: string; createdAt: string }): Project {
  const project: Project = {
    id: 1,
    description: [],
    world,
    importance: 'normal',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tasks: [],
    ...overrides,
  };
  // A single task, created after every project so project.createdAt drives column order.
  project.tasks = [createTask({ documentId: `t-${project.documentId}`, project, createdAt: '2026-02-01T00:00:00.000Z' })];
  return project;
}

const worldRuleset: LayoutRuleset = {
  slug: 'w',
  name: 'world',
  layout: 'projects',
  sections: [
    { worldMode: 'all', worldIds: [], importance: 'any', projectType: 'any', recurrence: 'both', longOnly: false },
  ],
};

function emptyData(projects: Project[]) {
  return {
    projects,
    categoryGroups: [],
    incidentals: [],
    recurringProjects: [],
    recurringCategoryGroups: [],
    recurringIncidentals: [],
  };
}

describe('Layout Transformer - projects layout column tiers', () => {
  beforeEach(() => {
    vi.mocked(dateUtils.getToday).mockReturnValue(dateUtils.parseDate('2026-06-01', EST));
  });

  it('orders columns by tier: top of mind → pN (by number, creation tiebreak) → normal → later', () => {
    const projects: Project[] = [
      makeProject({ documentId: 'top', title: 'Top thing', importance: 'top of mind', createdAt: '2026-01-01T00:00:00.000Z' }),
      // Beta is the OLDEST normal project but is p2 -> must sort after both p1s
      makeProject({ documentId: 'beta', title: 'Beta p2', createdAt: '2026-01-01T00:00:00.000Z' }),
      // Two p1 projects: Alpha older than Gamma -> Alpha first within the p1 group
      makeProject({ documentId: 'alpha', title: 'Alpha p1', createdAt: '2026-01-02T00:00:00.000Z' }),
      makeProject({ documentId: 'gamma', title: 'Gamma p1', createdAt: '2026-01-05T00:00:00.000Z' }),
      makeProject({ documentId: 'delta', title: 'Delta plain', createdAt: '2026-01-03T00:00:00.000Z' }),
      // importance "later" wins even though the title carries a p1 marker
      makeProject({ documentId: 'omega', title: 'Omega p1', importance: 'later', createdAt: '2026-01-04T00:00:00.000Z' }),
    ];

    const result = transformLayout(emptyData(projects), worldRuleset, EST, [world]);
    const columns = result.projectGroups![0].columns;
    const ids = columns.map((s) => ('documentId' in s ? s.documentId : s.title));

    // top of mind, then p1 group (oldest first) then p2, then normal, then later.
    expect(ids).toEqual(['top', 'alpha', 'gamma', 'beta', 'delta', 'omega']);
  });
});
