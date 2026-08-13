import type { Task, RecurrenceType } from '../types/index';

/**
 * The three lists a review is conducted from.
 *
 * They answer different questions, which is why they're separate. `topOfMind` is
 * *chosen* work — the tasks of the single top-of-mind project, the thing you
 * already decided matters this cycle. `soon` is the one-offs you flagged.
 * `recurring` is everything that comes back around regardless of what you think
 * about it.
 *
 * `soon` and `recurring` were one list at first, subdivided by recurrence type
 * with a heading over each ("every few days", "weekly", …). Those headings said
 * nothing a reader deciding what to do this week could act on — the cadence is a
 * property of how the task was set up, not of what it's asking for now — and
 * they made a dozen tasks read as seven lists. Two plain lists instead.
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
  /** One-off tasks flagged `soon`. */
  soon: Task[];
  /** Every incomplete recurring task, most to least frequent. */
  recurring: Task[];
}

const TOP_OF_MIND = 'top of mind';

/**
 * Frequency order, used only to sort the recurring list — daily things near the
 * top, seasonal ones near the bottom, so it reads roughly as "how often this
 * asks for you". No longer rendered as headings, and deliberately not a
 * priority: nothing here is more urgent than anything else.
 *
 * "monthly date" and "monthly day" are one idea to a reader, so they sort
 * together.
 */
const FREQUENCY_ORDER: Array<RecurrenceType> = [
  'daily',
  'every x days',
  'weekly',
  'biweekly',
  'monthly date',
  'monthly day',
  'annually',
  'full moon',
  'new moon',
  'every season',
  'winter solstice',
  'spring equinox',
  'summer solstice',
  'autumn equinox',
];

function frequencyRank(task: Task): number {
  const index = FREQUENCY_ORDER.indexOf(task.recurrenceType as RecurrenceType);
  // An unknown cadence sorts last rather than first, so a new recurrence type
  // added to the schema and not to this list degrades to the bottom of the list
  // instead of jumping the top of it.
  return index === -1 ? FREQUENCY_ORDER.length : index;
}

/**
 * Partition the task list into the review's lists.
 *
 * Every task lands in **at most one** of them. The precedence rules, in order:
 *
 *  1. A recurring task always goes to `recurring`, even when it belongs to the
 *     top-of-mind project — "recurring" says more about how you relate to a task
 *     than which project it sits in.
 *  2. Otherwise a task of the top-of-mind project goes to `topOfMind`, `soon`
 *     ones sorted first.
 *  3. Otherwise a `soon` task goes to `soon`.
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
  const soon: Task[] = [];
  const recurring: Task[] = [];

  for (const task of live) {
    if (task.isRecurring) {
      recurring.push(task);
      continue;
    }
    if (topOfMindProject && task.project?.documentId === topOfMindProject.documentId) {
      topOfMindTasks.push(task);
      continue;
    }
    if (task.soon) soon.push(task);
  }

  // `soon` first within the top-of-mind list; otherwise leave the incoming order
  // alone, which is the server's creation order.
  topOfMindTasks.sort((a, b) => Number(b.soon) - Number(a.soon));
  recurring.sort((a, b) => frequencyRank(a) - frequencyRank(b));

  return {
    topOfMind: topOfMindProject
      ? { projectTitle: topOfMindProject.title, tasks: topOfMindTasks }
      : null,
    soon,
    recurring,
  };
}
