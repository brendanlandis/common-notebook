import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, LayoutRuleset } from '@/app/types/index';
import * as dateUtils from './dateUtils';

// Mock date utilities (mirrors layoutTransformers.workSessions.test.ts)
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

function createProject(overrides: Partial<Project>): Project {
  return {
    id: 1,
    documentId: 'project-id',
    title: 'Project',
    description: [],
    world: 'day job',
    importance: 'normal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tasks: [createTask({ createdAt: '2026-01-10T00:00:00.000Z' })],
    ...overrides,
  };
}

const worldRuleset: LayoutRuleset = {
  id: 'day-job',
  name: 'day job',
  showRecurring: true,
  showNonRecurring: true,
  visibleWorlds: null,
  sortBy: 'creationDate',
  groupBy: 'world',
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

describe('Layout Transformer - priority tier (world grouping)', () => {
  beforeEach(() => {
    vi.mocked(dateUtils.getTodayInEST).mockReturnValue(new Date('2026-06-01T00:00:00'));
    vi.mocked(dateUtils.getNowInEST).mockReturnValue(new Date('2026-06-01T12:00:00'));
  });

  it('places pN projects in their own tier, ordered by N then creation date', () => {
    const projects: Project[] = [
      createProject({ documentId: 'top', title: 'Top thing', importance: 'top of mind', createdAt: '2026-01-01T00:00:00.000Z' }),
      // Beta is the OLDEST normal project but is p2 -> must sort after both p1s
      createProject({ documentId: 'beta', title: 'Beta p2', createdAt: '2026-01-01T00:00:00.000Z' }),
      // Two p1 projects: Alpha older than Gamma -> Alpha first within the p1 group
      createProject({ documentId: 'alpha', title: 'Alpha p1', createdAt: '2026-01-02T00:00:00.000Z' }),
      createProject({ documentId: 'gamma', title: 'Gamma p1', createdAt: '2026-01-05T00:00:00.000Z' }),
      createProject({ documentId: 'delta', title: 'Delta plain', createdAt: '2026-01-03T00:00:00.000Z' }),
      // importance "later" wins even though the title carries a p1 marker
      createProject({ documentId: 'omega', title: 'Omega p1', importance: 'later', createdAt: '2026-01-04T00:00:00.000Z' }),
    ];

    const result = transformLayout(emptyData(projects), worldRuleset);
    const dayJob = result.worldSections!.get('day job')!;

    const ids = (sections: typeof dayJob.priority) =>
      sections.map((s) => ('documentId' in s ? s.documentId : s.title));

    // Priority tier: p1 group (oldest-first) then p2
    expect(ids(dayJob.priority)).toEqual(['alpha', 'gamma', 'beta']);

    // Normal tier holds only the unmarked project
    expect(ids(dayJob.normal)).toEqual(['delta']);

    // Importance still takes precedence
    expect(ids(dayJob.topOfMindAndCategories)).toEqual(['top']);
    expect(ids(dayJob.later)).toEqual(['omega']);
  });
});
