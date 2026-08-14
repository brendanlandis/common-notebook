import { describe, it, expect } from 'vitest';
import {
  buildReviewLists,
  groupByProject,
  partitionSelected,
  type ProjectGroup,
  type ReviewWindow,
} from './reviewLists';
import type { Task, Project, RecurrenceType } from '../types/index';

/**
 * What qualifies for the review's list, and above all the promise that **a task
 * appears exactly once**. Several rules can pull the same task in — it can be
 * `soon`, recurring, and in the top-of-mind project all at once — and a task
 * shown twice on a planning surface is worse than one missing: you'd commit to
 * it twice and count it twice.
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

const allIds = (lists: ReturnType<typeof buildReviewLists>): string[] => flat(lists.groups);

/** One group's task ids, by project title. */
const group = (lists: ReturnType<typeof buildReviewLists>, title: string | null) =>
  (lists.groups.find((g) => g.projectTitle === title)?.tasks ?? []).map((t) => t.documentId);

describe('buildReviewLists', () => {
  const topProject = project({ documentId: 'p-top', title: 'the album', importance: 'top of mind' });

  it('leads with the top-of-mind project', () => {
    const lists = buildReviewLists([
      task({ documentId: 't-other', soon: true, project: project({ documentId: 'p-x', title: 'other' }) }),
      task({ documentId: 't-top', project: topProject }),
    ]);

    expect(lists.groups[0].projectTitle).toBe('the album');
  });

  it('leaves the order alone when nothing is top of mind', () => {
    const lists = buildReviewLists([
      task({ documentId: 't-b', soon: true, project: project({ documentId: 'p-b', title: 'bee' }) }),
      task({ documentId: 't-a', soon: true, project: project({ documentId: 'p-a', title: 'ay' }) }),
    ]);

    expect(lists.groups.map((g) => g.projectTitle)).toEqual(['bee', 'ay']);
  });

  it('sorts soon tasks to the top of the top-of-mind group', () => {
    const ordinary = task({ documentId: 't-ordinary', project: topProject });
    const soon = task({ documentId: 't-soon', project: topProject, soon: true });

    const lists = buildReviewLists([ordinary, soon]);

    expect(group(lists, 'the album')).toEqual(['t-soon', 't-ordinary']);
  });

  it('keeps a recurring task in its own project’s group', () => {
    // It used to be split out into a "recurring" list of its own, which meant a
    // project's work was described in two places at once.
    const lists = buildReviewLists([
      task({ documentId: 't-plain', project: topProject }),
      task({
        documentId: 't-recurring',
        project: topProject,
        isRecurring: true,
        recurrenceType: 'weekly',
      }),
    ]);

    expect(group(lists, 'the album')).toEqual(['t-plain', 't-recurring']);
  });

  it('gathers soon one-offs and recurring tasks into the same list', () => {
    const lists = buildReviewLists([
      task({ documentId: 't-soon', soon: true }),
      task({ documentId: 't-weekly', isRecurring: true, recurrenceType: 'weekly' }),
    ]);

    expect(allIds(lists)).toEqual(['t-soon', 't-weekly']);
  });

  it('never lists a task twice', () => {
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

    expect(allIds(buildReviewLists([ancient, fresh]))).toEqual(['t-ancient', 't-fresh']);
  });

  it('drops completed tasks', () => {
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

    expect(allIds(lists)).toEqual(['t-weekly', 't-date', 't-day', 't-annual']);
  });

  it('orders recurring work from most to least frequent', () => {
    const lists = buildReviewLists([
      task({ documentId: 'season', isRecurring: true, recurrenceType: 'every season' }),
      task({ documentId: 'weekly', isRecurring: true, recurrenceType: 'weekly' }),
      task({ documentId: 'daily', isRecurring: true, recurrenceType: 'daily' }),
    ]);

    expect(allIds(lists)).toEqual(['daily', 'weekly', 'season']);
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

    expect(allIds(lists)).toEqual(['weekly', 'unknown']);
  });

  it('survives more than one top-of-mind project without crashing', () => {
    // The single-top-of-mind invariant is maintained by writes, not a database
    // constraint, so a second one is possible and must not throw.
    const other = project({ documentId: 'p-other', title: 'other', importance: 'top of mind' });

    const lists = buildReviewLists([
      task({ documentId: 'a', project: topProject }),
      task({ documentId: 'b', project: other }),
    ]);

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

describe('partitionSelected', () => {
  const alpha = project({ documentId: 'p-a', title: 'alpha' });
  const beta = project({ documentId: 'p-b', title: 'beta' });

  const groups = () =>
    groupByProject([
      task({ documentId: '1', project: alpha }),
      task({ documentId: '2', project: alpha }),
      task({ documentId: '3', project: beta }),
    ]);

  it('lifts the picked out of their groups', () => {
    const { picked, remaining } = partitionSelected(groups(), new Set(['2']));

    expect(picked.map((t) => t.documentId)).toEqual(['2']);
    expect(flat(remaining)).toEqual(['1', '3']);
  });

  it('keeps the picked in list order, not click order', () => {
    // A list that reshuffles as you add to it makes you re-find everything you
    // already chose.
    const { picked } = partitionSelected(groups(), new Set(['3', '1']));

    expect(picked.map((t) => t.documentId)).toEqual(['1', '3']);
  });

  it('drops a group it has emptied', () => {
    // Otherwise a project whose every task is picked leaves a heading over
    // nothing.
    const { remaining } = partitionSelected(groups(), new Set(['3']));

    expect(remaining.map((g) => g.projectTitle)).toEqual(['alpha']);
  });

  it('leaves the groups alone when nothing is picked', () => {
    const { picked, remaining } = partitionSelected(groups(), new Set());

    expect(picked).toEqual([]);
    expect(flat(remaining)).toEqual(['1', '2', '3']);
  });

  it('does not mutate the groups it was given', () => {
    // They come from a memo over the task list; emptying one in place would
    // survive into the next render as tasks that had silently vanished.
    const original = groups();

    partitionSelected(original, new Set(['1', '2', '3']));

    expect(flat(original)).toEqual(['1', '2', '3']);
  });
});

/**
 * Which recurring tasks belong to the cycle on screen.
 *
 * They were included wholesale at first, so a review of a week in August listed
 * an annual task due in November — a catalogue of everything that recurs rather
 * than a picture of what this week is going to ask for.
 *
 * These dates are compared as strings on purpose, and that is the thing to
 * preserve: `displayDate` and the period bounds are all `YYYY-MM-DD` wall-clock
 * dates, and lexicographic order on that format is chronological order. Parsing
 * them into instants would introduce a timezone question where none exists,
 * which is how this codebase has produced three separate date bugs. So there is
 * nothing zone-dependent here to test across the matrix — and nothing that
 * should become zone-dependent later.
 */
describe('buildReviewLists — has it come round yet', () => {
  const WEEK: ReviewWindow = { periodStart: '2026-08-10', periodEnd: '2026-08-16' };

  const recurring = (displayDate: string | null, title: string) =>
    task({ title, isRecurring: true, recurrenceType: 'weekly' as RecurrenceType, displayDate });

  const titles = (groups: ProjectGroup[]) => groups.flatMap((g) => g.tasks.map((t) => t.title));

  it('keeps a recurring task that comes round during the cycle', () => {
    const { groups } = buildReviewLists([recurring('2026-08-13', 'water the plants')], WEEK);

    expect(titles(groups)).toEqual(['water the plants']);
  });

  it('keeps one landing on the last day of the cycle', () => {
    // Inclusive: the final day of a cycle is in it.
    const { groups } = buildReviewLists(
      [recurring('2026-08-10', 'monday'), recurring('2026-08-16', 'sunday')],
      WEEK
    );

    expect(titles(groups)).toEqual(['monday', 'sunday']);
  });

  it('drops one due after the cycle ends', () => {
    // The case that prompted this: an annual task in November, in a review of a
    // week in August.
    const { groups } = buildReviewLists([recurring('2026-11-02', 'file taxes')], WEEK);

    expect(titles(groups)).toEqual([]);
  });

  it('keeps one whose date has already gone by', () => {
    // The test is one-sided on purpose. A chore that came round last Tuesday and
    // never got done is still on your plate, and the review is the only page you
    // plan on — dropping it here while it carried on showing on /todo made the
    // two disagree about what there is to do.
    const { groups } = buildReviewLists(
      [recurring('2026-08-03', 'last week'), recurring('2019-01-01', 'long ago')],
      WEEK
    );

    expect(titles(groups)).toEqual(['last week', 'long ago']);
  });

  it('keeps one whose due date is in the window, shown early', () => {
    // `displayDate` is `dueDate` minus a positive offset, so a task due on
    // Friday and surfaced three days ahead has both dates inside the window and
    // needs no separate due-date test — this pins that reading.
    const early = task({
      title: 'passport renewal',
      isRecurring: true,
      recurrenceType: 'annually' as RecurrenceType,
      displayDate: '2026-08-11',
      dueDate: '2026-08-14',
      displayDateOffset: 3,
    });

    expect(titles(buildReviewLists([early], WEEK).groups)).toEqual(['passport renewal']);
  });

  it('keeps a recurring task with no date at all', () => {
    // Same reading as `groupTasksForLayout`: absent means nothing is holding it
    // back, not hide it.
    const { groups } = buildReviewLists([recurring(null, 'whenever')], WEEK);

    expect(titles(groups)).toEqual(['whenever']);
  });

  it('leaves non-recurring tasks alone, whatever their date', () => {
    // `soon` and top-of-mind tasks earn their place a different way; a
    // displayDate outside the cycle says nothing about them.
    const { groups } = buildReviewLists(
      [
        task({ title: 'soon thing', soon: true, displayDate: '2026-11-02' }),
        task({ title: 'top of mind thing', project: project({ importance: 'top of mind' }), displayDate: '2026-01-01' }),
      ],
      WEEK
    );

    expect(titles(groups).sort()).toEqual(['soon thing', 'top of mind thing']);
  });

  it('filters nothing when there is no window yet', () => {
    // The cadence arrives from a query; until it does there is no period to
    // filter against, and that render path shows a message rather than a list.
    const { groups } = buildReviewLists([recurring('2026-11-02', 'file taxes')], null);

    expect(titles(groups)).toEqual(['file taxes']);
  });

  it('still drops completed recurring tasks inside the window', () => {
    const done = task({
      title: 'done already',
      isRecurring: true,
      recurrenceType: 'weekly' as RecurrenceType,
      displayDate: '2026-08-13',
      completed: true,
    });

    expect(titles(buildReviewLists([done], WEEK).groups)).toEqual([]);
  });
});
