import type { Task, RecurrenceType } from '../types/index';

/**
 * The two lists a review is conducted from.
 *
 * Two rather than one because they answer different questions. List A is
 * *chosen* work — the tasks of the single top-of-mind project, the thing you
 * already decided matters this cycle. List B is everything that will ask for
 * attention regardless: tasks flagged `soon`, plus every incomplete recurring
 * task.
 *
 * Recurring tasks appear in full, with no dates and no ordering by age. That is
 * deliberate and is the rule this whole feature is shaped around: if a task has
 * no due date then it has no due date, and ranking by how overdue something is
 * turns a planning tool into a productivity tool. A recurring task that has sat
 * incomplete for a month is presented exactly like one generated yesterday.
 */

export interface ReviewLists {
  /** The top-of-mind project's tasks, `soon` ones first. Null when nothing is top of mind. */
  topOfMind: { projectTitle: string; tasks: Task[] } | null;
  /** `soon` tasks and all incomplete recurring tasks, grouped by recurrence type. */
  surfacing: { recurrenceType: RecurrenceType | 'one-off'; tasks: Task[] }[];
}

const TOP_OF_MIND = 'top of mind';

/**
 * "monthly date" and "monthly day" are one idea to a reader choosing what to do
 * this week; the distinction is a scheduling detail.
 */
function groupKey(task: Task): RecurrenceType | 'one-off' {
  if (!task.isRecurring) return 'one-off';
  if (task.recurrenceType === 'monthly date' || task.recurrenceType === 'monthly day') {
    return 'monthly date';
  }
  return task.recurrenceType;
}

// Ordering of the surfacing groups: the one-offs you flagged, then recurring
// work from most to least frequent, so the list reads as "today-ish" downward.
const GROUP_ORDER: Array<RecurrenceType | 'one-off'> = [
  'one-off',
  'daily',
  'every x days',
  'weekly',
  'biweekly',
  'monthly date',
  'annually',
  'full moon',
  'new moon',
  'every season',
  'winter solstice',
  'spring equinox',
  'summer solstice',
  'autumn equinox',
];

/**
 * Partition the task list into the review's two lists.
 *
 * Every task lands in **at most one** of them. The precedence rules, in order:
 *
 *  1. A recurring task always goes to `surfacing`, even when it belongs to the
 *     top-of-mind project — "recurring" says more about how you relate to a task
 *     than which project it sits in.
 *  2. Otherwise a task of the top-of-mind project goes to `topOfMind`, `soon`
 *     ones sorted first.
 *  3. Otherwise a `soon` task goes to `surfacing`.
 *
 * Completed tasks are dropped throughout. The visibility window that keeps a
 * just-ticked task on the To Do page has no meaning here: this is a planning
 * surface, not a working one.
 */
export function buildReviewLists(tasks: Task[]): ReviewLists {
  const live = tasks.filter((task) => !task.completed);

  // One project can be top of mind at a time — enforced server-side on write by
  // demoteTopOfMindProjects. Read defensively anyway: the invariant is
  // maintained by writes, not by a database constraint, so take the first rather
  // than assuming there is exactly one.
  const topOfMindProject =
    live.find((task) => task.project?.importance === TOP_OF_MIND)?.project ?? null;

  const topOfMindTasks: Task[] = [];
  const surfacingTasks: Task[] = [];

  for (const task of live) {
    if (task.isRecurring) {
      surfacingTasks.push(task);
      continue;
    }
    if (topOfMindProject && task.project?.documentId === topOfMindProject.documentId) {
      topOfMindTasks.push(task);
      continue;
    }
    if (task.soon) surfacingTasks.push(task);
  }

  // `soon` first within the top-of-mind list; otherwise leave the incoming order
  // alone, which is the server's creation order.
  topOfMindTasks.sort((a, b) => Number(b.soon) - Number(a.soon));

  const byGroup = new Map<RecurrenceType | 'one-off', Task[]>();
  for (const task of surfacingTasks) {
    const key = groupKey(task);
    const group = byGroup.get(key);
    if (group) group.push(task);
    else byGroup.set(key, [task]);
  }

  const surfacing = GROUP_ORDER.filter((key) => byGroup.has(key)).map((key) => ({
    recurrenceType: key,
    tasks: byGroup.get(key)!,
  }));

  return {
    topOfMind: topOfMindProject
      ? { projectTitle: topOfMindProject.title, tasks: topOfMindTasks }
      : null,
    surfacing,
  };
}

/** Human labels for the surfacing groups. */
export const GROUP_LABELS: Record<string, string> = {
  'one-off': 'soon',
  daily: 'daily',
  'every x days': 'every few days',
  weekly: 'weekly',
  biweekly: 'biweekly',
  'monthly date': 'monthly',
  annually: 'annually',
  'full moon': 'full moon',
  'new moon': 'new moon',
  'every season': 'seasonal',
  'winter solstice': 'winter solstice',
  'spring equinox': 'spring equinox',
  'summer solstice': 'summer solstice',
  'autumn equinox': 'autumn equinox',
};
