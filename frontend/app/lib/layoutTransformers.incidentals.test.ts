import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transformLayout } from './layoutTransformers';
import type { Task, Project, World, LayoutRuleset, WorldMode } from '@/app/types/index';
import * as dateUtils from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return { ...actual, getToday: vi.fn() };
});

/**
 * Incidentals (tasks with no project, so no world) under each worldMode.
 *
 * The seeded "everything" view is `worldRule: 'combined'`, which migrates to
 * `worldMode: 'except'` with an empty list, and it dropped every incidental:
 * `showIncidentals` was `worldMode === 'all'`. Nothing in an except-list can
 * name a world an incidental does not have, so `except` shows them like `all`
 * does; `only` is the one mode scoped to named worlds, and hides them.
 */
const music: World = { id: 1, documentId: 'w-music', title: 'music', slug: 'music', position: 0, systemKey: null };
const house: World = { id: 2, documentId: 'w-house', title: 'house', slug: 'house', position: 1, systemKey: null };

function project(documentId: string, world: World): Project {
  return {
    id: 1,
    documentId,
    title: documentId,
    description: [],
    world,
    importance: 'normal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
  };
}

function task(documentId: string, proj: Project | null): Task {
  return {
    id: 1,
    documentId,
    title: documentId,
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
    project: proj,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    onHold: false,
    materialCategory: null,
    workSessions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
  };
}

const musicProject = project('p-music', music);
const houseProject = project('p-house', house);

function data() {
  return {
    projects: [
      { ...musicProject, tasks: [task('t-music', musicProject)] },
      { ...houseProject, tasks: [task('t-house', houseProject)] },
    ],
    categoryGroups: [],
    incidentals: [task('t-loose', null)],
    recurringProjects: [],
    recurringCategoryGroups: [],
    recurringIncidentals: [],
  };
}

// The "everything" view: one chronological section.
function everything(worldMode: WorldMode, worldIds: string[] = []): LayoutRuleset {
  return {
    slug: 'everything',
    name: 'everything',
    layout: 'chronological',
    sections: [{ worldMode, worldIds, importance: 'any', projectType: 'any', recurrence: 'both', longOnly: false }],
  };
}

const ids = (ruleset: LayoutRuleset) =>
  transformLayout(data(), ruleset, EST, [music, house]).chronologicalTasks!.map((t) => t.documentId).sort();

describe('incidentals by worldMode', () => {
  beforeEach(() => {
    vi.mocked(dateUtils.getToday).mockReturnValue(dateUtils.parseDate('2026-06-01', EST));
  });

  it('all: every task, incidentals included', () => {
    expect(ids(everything('all'))).toEqual(['t-house', 't-loose', 't-music']);
  });

  it('except with nothing named (the seeded everything view): same as all', () => {
    expect(ids(everything('except'))).toEqual(['t-house', 't-loose', 't-music']);
  });

  it('except a world: that world goes, the incidental stays', () => {
    expect(ids(everything('except', ['w-house']))).toEqual(['t-loose', 't-music']);
  });

  it('only a world: scoped to it, so the incidental is hidden', () => {
    expect(ids(everything('only', ['w-music']))).toEqual(['t-music']);
  });
});
