import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, LayoutRuleset } from '@/app/types/index';
import * as dateUtils from './dateUtils';

// Mock date utilities (mirrors layoutTransformers.priority.test.ts)
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

function createProjectMeta(overrides: Partial<Project>): Project {
  return {
    id: 1,
    documentId: 'project-id',
    title: 'Project',
    description: [],
    world: 'life stuff',
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
    category: null,
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

// The per-project view builds this ruleset inline (project/[documentId]/page.tsx).
const baseRuleset: LayoutRuleset = {
  id: 'project-view',
  name: 'project',
  showRecurring: true,
  showNonRecurring: true,
  visibleWorlds: null,
  visibleCategories: null,
  sortBy: 'creationDate',
  groupBy: 'merged',
};
const projectRuleset: LayoutRuleset = { ...baseRuleset, visibleProjects: ['target'] };

function dataWithBothProjects() {
  return {
    projects: [
      { ...targetMeta, tasks: [createTask({ documentId: 't1', title: 'Target task', project: targetMeta })] },
      { ...otherMeta, tasks: [createTask({ documentId: 't2', title: 'Other task', project: otherMeta })] },
    ],
    categoryGroups: [
      { title: 'home chores', tasks: [createTask({ documentId: 'c1', category: 'home chores' })] },
    ],
    incidentals: [createTask({ documentId: 'i1', title: 'Loose end' })],
    recurringProjects: [],
    recurringCategoryGroups: [],
    recurringIncidentals: [],
  };
}

describe('Layout Transformer - visibleProjects filter (per-project view)', () => {
  beforeEach(() => {
    vi.mocked(dateUtils.getTodayInEST).mockReturnValue(new Date('2026-06-01T00:00:00'));
    vi.mocked(dateUtils.getNowInEST).mockReturnValue(new Date('2026-06-01T12:00:00'));
  });

  it('keeps only the targeted project and drops other projects, categories, and incidentals', () => {
    const result = transformLayout(dataWithBothProjects(), projectRuleset);

    const sectionIds = (result.allSections || []).map((s) =>
      'documentId' in s ? s.documentId : s.title
    );

    // Exactly the one requested project section survives.
    expect(sectionIds).toEqual(['target']);

    const targetSection = result.allSections!.find(
      (s) => 'documentId' in s && s.documentId === 'target'
    ) as Project;
    expect(targetSection.tasks!.map((t) => t.documentId)).toEqual(['t1']);

    // Project-less tasks (categories + incidentals) have no project.documentId,
    // so the guard removes them.
    expect(result.incidentals).toBeUndefined();
  });

  it('shows all projects when visibleProjects is omitted', () => {
    const result = transformLayout(dataWithBothProjects(), baseRuleset);

    const sectionIds = (result.allSections || []).map((s) =>
      'documentId' in s ? s.documentId : s.title
    );

    expect(sectionIds).toContain('target');
    expect(sectionIds).toContain('other');
  });
});
