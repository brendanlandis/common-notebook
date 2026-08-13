import { describe, it, expect } from 'vitest';
import { buildReviewLists, groupByProject, type ProjectGroup } from './reviewLists';
import type { Task, Project, RecurrenceType } from '../types/index';

/**
 * The partitioning rules for the review's three lists, and above all the promise
 * that **every task lands in at most one of them**. A task appearing twice in a
 * planning surface is worse than one missing: you'd commit to it twice and
 * count it twice.
 */

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    documentId: 'p-1',
    title: 'a project',
    description: [],
    importance: 'normal',
    ...overrides,
  } as Project;
}

let seq = 0;
function task(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: seq,
    documentId: `t-${seq}`,
    title: `task ${seq}`,
    description: [],
    completed: false,
    completedAt: null,
    dueDate: null,
    displayDate: null,
    displayDateOffset: null,
    isRecurring: false,
    recurrenceType: 'none' as RecurrenceType,
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    createdAt: '',
    updatedAt: '',
    publishedAt: '',
    ...overrides,
  };
}

/** Every task in a grouped list, in render order. */
const flat = (groups: ProjectGroup[]): string[] =>
  groups.flatMap((group) => group.tasks.map((t) => t.documentId));

const allIds = (lists: ReturnType<typeof buildReviewLists>): string[] => [
  ...(lists.topOfMind?.tasks ?? []).map((t) => t.documentId),
  ...flat(lists.soon),
  ...flat(lists.recurring),
];

describe('buildReviewLists', () => {
  const topProject = project({ documentId: 'p-top', title: 'the album', importance: 'top of mind' });

  it('titles list A with the top-of-mind project', () => {
    const lists = buildReviewLists([task({ project: topProject })]);

    expect(lists.topOfMind?.projectTitle).toBe('the album');
  });

  it('is null for list A when nothing is top of mind', () => {
    const lists = buildReviewLists([task({ project: project() })]);

    expect(lists.topOfMind).toBeNull();
  });

  it('sorts soon tasks to the top of list A', () => {
    const ordinary = task({ documentId: 't-ordinary', project: topProject });
    const soon = task({ documentId: 't-soon', project: topProject, soon: true });

    const lists = buildReviewLists([ordinary, soon]);

    expect(lists.topOfMind!.tasks.map((t) => t.documentId)).toEqual([
      't-soon',
      't-ordinary',
    ]);
  });

  it('sends a recurring task to the recurring list even inside the top-of-mind project', () => {
    // "Recurring" says more about how you relate to a task than which project
    // it happens to sit in.
    const recurring = task({
      documentId: 't-recurring',
      project: topProject,
      isRecurring: true,
      recurrenceType: 'weekly',
    });

    const lists = buildReviewLists([recurring]);

    expect(lists.topOfMind!.tasks).toEqual([]);
    expect(flat(lists.recurring)).toEqual(['t-recurring']);
  });

  it('keeps soon one-offs and recurring tasks in separate lists', () => {
    // They were one list with a heading per recurrence type. The headings said
    // nothing actionable, so the split is now the only structure.
    const lists = buildReviewLists([
      task({ documentId: 't-soon', soon: true }),
      task({ documentId: 't-weekly', isRecurring: true, recurrenceType: 'weekly' }),
    ]);

    expect(flat(lists.soon)).toEqual(['t-soon']);
    expect(flat(lists.recurring)).toEqual(['t-weekly']);
  });

  it('never places a task in both lists', () => {
    // The overlap case: soon AND in the top-of-mind project AND recurring.
    const tasks = [
      task({ documentId: 'a', project: topProject, soon: true }),
      task({ documentId: 'b', project: topProject }),
      task({
        documentId: 'c',
        project: topProject,
        soon: true,
        isRecurring: true,
        recurrenceType: 'daily',
      }),
      task({ documentId: 'd', soon: true }),
      task({ documentId: 'e', isRecurring: true, recurrenceType: 'weekly' }),
    ];

    const ids = allIds(buildReviewLists(tasks));

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('leaves out tasks that are neither soon, recurring, nor top of mind', () => {
    // The review is a narrowing, not the whole list — /todo is where everything
    // lives.
    const lists = buildReviewLists([task({ documentId: 'ignored', project: project() })]);

    expect(allIds(lists)).toEqual([]);
  });

  it('includes every incomplete recurring task regardless of age', () => {
    // No due date means no due date. A recurring task untouched for a month is
    // presented exactly like one generated yesterday — no ordering by staleness,
    // no filtering by date.
    const ancient = task({
      documentId: 't-ancient',
      isRecurring: true,
      recurrenceType: 'daily',
      displayDate: '2020-01-01',
    });
    const fresh = task({
      documentId: 't-fresh',
      isRecurring: true,
      recurrenceType: 'daily',
      displayDate: '2026-08-13',
    });

    const { recurring } = buildReviewLists([ancient, fresh]);

    expect(flat(recurring)).toEqual(['t-ancient', 't-fresh']);
  });

  it('drops completed tasks from both lists', () => {
    const lists = buildReviewLists([
      task({ documentId: 'done-top', project: topProject, completed: true }),
      task({ documentId: 'done-soon', soon: true, completed: true }),
      task({
        documentId: 'done-recurring',
        isRecurring: true,
        recurrenceType: 'weekly',
        completed: true,
      }),
    ]);

    expect(allIds(lists)).toEqual([]);
  });

  it('keeps the two monthly shapes adjacent', () => {
    // One idea to a reader, so they sort together rather than straddling
    // whatever falls between them alphabetically.
    const lists = buildReviewLists([
      task({ documentId: 't-annual', isRecurring: true, recurrenceType: 'annually' }),
      task({ documentId: 't-day', isRecurring: true, recurrenceType: 'monthly day' }),
      task({ documentId: 't-weekly', isRecurring: true, recurrenceType: 'weekly' }),
      task({ documentId: 't-date', isRecurring: true, recurrenceType: 'monthly date' }),
    ]);

    expect(flat(lists.recurring)).toEqual(['t-weekly', 't-date', 't-day', 't-annual']);
  });

  it('orders the recurring list from most to least frequent', () => {
    const lists = buildReviewLists([
      task({ documentId: 'season', isRecurring: true, recurrenceType: 'every season' }),
      task({ documentId: 'weekly', isRecurring: true, recurrenceType: 'weekly' }),
      task({ documentId: 'daily', isRecurring: true, recurrenceType: 'daily' }),
    ]);

    expect(flat(lists.recurring)).toEqual(['daily', 'weekly', 'season']);
  });

  it('sorts an unrecognised cadence to the bottom rather than the top', () => {
    // A recurrence type added to the schema and not to the frequency list must
    // degrade quietly, not jump the queue.
    const lists = buildReviewLists([
      task({
        documentId: 'unknown',
        isRecurring: true,
        recurrenceType: 'fortnightly-ish' as RecurrenceType,
      }),
      task({ documentId: 'weekly', isRecurring: true, recurrenceType: 'weekly' }),
    ]);

    expect(flat(lists.recurring)).toEqual(['weekly', 'unknown']);
  });

  it('survives more than one top-of-mind project without crashing', () => {
    // The single-top-of-mind invariant is maintained by writes, not a database
    // constraint, so a second one is possible and must not throw.
    const other = project({ documentId: 'p-other', title: 'other', importance: 'top of mind' });

    const lists = buildReviewLists([
      task({ documentId: 'a', project: topProject }),
      task({ documentId: 'b', project: other }),
    ]);

    expect(lists.topOfMind).not.toBeNull();
    const ids = allIds(lists);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('groupByProject', () => {
  const alpha = project({ documentId: 'p-a', title: 'alpha' });
  const beta = project({ documentId: 'p-b', title: 'beta' });

  it('gathers a project’s tasks under one group', () => {
    const groups = groupByProject([
      task({ documentId: '1', project: alpha }),
      task({ documentId: '2', project: beta }),
      task({ documentId: '3', project: alpha }),
    ]);

    expect(groups.map((g) => g.projectTitle)).toEqual(['alpha', 'beta']);
    expect(flat(groups)).toEqual(['1', '3', '2']);
  });

  it('keeps first-appearance order rather than sorting', () => {
    // The caller has already established an order — creation date, or frequency
    // for the recurring list — and an alphabetical one here would override it.
    const groups = groupByProject([
      task({ documentId: '1', project: beta }),
      task({ documentId: '2', project: alpha }),
    ]);

    expect(groups.map((g) => g.projectTitle)).toEqual(['beta', 'alpha']);
  });

  it('puts the unprojected last, under a null title', () => {
    // Incidentals are the leftovers by definition. Null rather than a label, so
    // the naming stays a UI decision.
    const groups = groupByProject([
      task({ documentId: '1' }),
      task({ documentId: '2', project: alpha }),
    ]);

    expect(groups.map((g) => g.projectTitle)).toEqual(['alpha', null]);
  });

  it('gives every group a distinct key', () => {
    const groups = groupByProject([
      task({ documentId: '1', project: alpha }),
      task({ documentId: '2', project: beta }),
      task({ documentId: '3' }),
    ]);

    expect(new Set(groups.map((g) => g.key)).size).toBe(3);
  });

  it('is empty for no tasks', () => {
    expect(groupByProject([])).toEqual([]);
  });
});
