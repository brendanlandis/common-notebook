import { describe, it, expect } from 'vitest';
import { buildReviewLists } from './reviewLists';
import type { Task, Project, RecurrenceType } from '../types/index';

/**
 * The partitioning rules for the review's two lists, and above all the promise
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

const allIds = (lists: ReturnType<typeof buildReviewLists>): string[] => [
  ...(lists.topOfMind?.tasks ?? []).map((t) => t.documentId),
  ...lists.surfacing.flatMap((g) => g.tasks.map((t) => t.documentId)),
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

  it('sends a recurring task to list B even inside the top-of-mind project', () => {
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
    expect(lists.surfacing.flatMap((g) => g.tasks.map((t) => t.documentId))).toEqual([
      't-recurring',
    ]);
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

    const daily = buildReviewLists([ancient, fresh]).surfacing.find(
      (g) => g.recurrenceType === 'daily'
    )!;

    expect(daily.tasks.map((t) => t.documentId)).toEqual(['t-ancient', 't-fresh']);
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

  it('merges the two monthly shapes into one group', () => {
    const byDate = task({
      documentId: 't-date',
      isRecurring: true,
      recurrenceType: 'monthly date',
    });
    const byDay = task({
      documentId: 't-day',
      isRecurring: true,
      recurrenceType: 'monthly day',
    });

    const lists = buildReviewLists([byDate, byDay]);
    const monthly = lists.surfacing.filter((g) => g.recurrenceType === 'monthly date');

    expect(monthly).toHaveLength(1);
    expect(monthly[0].tasks).toHaveLength(2);
  });

  it('orders groups from most to least frequent, soon first', () => {
    const lists = buildReviewLists([
      task({ documentId: 'season', isRecurring: true, recurrenceType: 'every season' }),
      task({ documentId: 'weekly', isRecurring: true, recurrenceType: 'weekly' }),
      task({ documentId: 'soon', soon: true }),
      task({ documentId: 'daily', isRecurring: true, recurrenceType: 'daily' }),
    ]);

    expect(lists.surfacing.map((g) => g.recurrenceType)).toEqual([
      'one-off',
      'daily',
      'weekly',
      'every season',
    ]);
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
