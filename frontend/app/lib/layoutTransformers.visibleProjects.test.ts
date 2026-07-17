import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, LayoutRuleset } from '@/app/types/index';
import * as dateUtils from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

// The timezone and day boundary are parameters now; these tests pin them.
const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

// Mock date utilities (mirrors layoutTransformers.priority.test.ts)
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

const targetMeta = createProjectMeta({ documentId: 'target', title: 'Target project' });
const otherMeta = createProjectMeta({ documentId: 'other', title: 'Other project' });

// The per-project view builds this ruleset inline (project/[slug]/page.tsx).
const baseRuleset: LayoutRuleset = {
  slug: 'project-view',
  name: 'project',
  layout: 'projects',
  sections: [
    { worldMode: 'all', worldIds: [], importance: 'any', projectType: 'any', recurrence: 'both', longOnly: false },
  ],
};
const projectRuleset: LayoutRuleset = { ...baseRuleset, visibleProjects: ['target'] };

function dataWithBothProjects() {
  return {
    projects: [
      { ...targetMeta, tasks: [createTask({ documentId: 't1', title: 'Target task', project: targetMeta })] },
      { ...otherMeta, tasks: [createTask({ documentId: 't2', title: 'Other task', project: otherMeta })] },
    ],
    categoryGroups: [
      { title: 'home chores', tasks: [createTask({ documentId: 'c1' })] },
    ],
    incidentals: [createTask({ documentId: 'i1', title: 'Loose end' })],
    recurringProjects: [],
    recurringCategoryGroups: [],
    recurringIncidentals: [],
  };
}

describe('Layout Transformer - visibleProjects filter (per-project view)', () => {
  beforeEach(() => {
    vi.mocked(dateUtils.getToday).mockReturnValue(dateUtils.parseDate('2026-06-01', EST));
  });

  it('keeps only the targeted project and drops other projects, categories, and incidentals', () => {
    const result = transformLayout(dataWithBothProjects(), projectRuleset, EST, []);
    const columns = result.projectGroups![0].columns;
    const sectionIds = columns.map((s) => ('documentId' in s ? s.documentId : s.title));

    // Exactly the one requested project column survives.
    expect(sectionIds).toEqual(['target']);

    const targetSection = columns.find(
      (s) => 'documentId' in s && s.documentId === 'target'
    ) as Project;
    expect(targetSection.tasks!.map((t) => t.documentId)).toEqual(['t1']);

    // Project-less tasks (categories + incidentals) have no project.documentId,
    // so the guard removes them.
    expect(result.projectGroups![0].incidentals).toEqual([]);
  });

  it('shows all projects when visibleProjects is omitted', () => {
    const result = transformLayout(dataWithBothProjects(), baseRuleset, EST, []);
    const sectionIds = result.projectGroups![0].columns.map((s) =>
      'documentId' in s ? s.documentId : s.title
    );

    expect(sectionIds).toContain('target');
    expect(sectionIds).toContain('other');
  });
});
