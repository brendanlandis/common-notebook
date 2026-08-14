import type { Task, RecurrenceType } from '../types/index';

/**
 * What's on your plate this cycle: one list, grouped by project.
 *
 * Three things land in it — the tasks of the single top-of-mind project, the
 * one-offs flagged `soon`, and every incomplete recurring task. They came from
 * different places and for a while they were rendered as separate lists, which
 * turned out to be a distinction the reader doesn't need: whatever put a task
 * here, it's here, and the only grouping that helps when you're choosing is
 * which project it belongs to.
 *
 * (Before that they were subdivided by *recurrence type* — "every few days",
 * "weekly" — which was worse still: a property of how the task was set up rather
 * than of what it's asking for now, and it made a dozen tasks read as seven
 * lists.)
 *
 * Recurring tasks appear in full, with no dates and no ordering by age. That is
 * deliberate and is the rule this whole feature is shaped around: if a task has
 * no due date then it has no due date, and ranking by how overdue something is
 * turns a planning tool into a productivity tool. A recurring task that has sat
 * incomplete for a month is presented exactly like one generated yesterday.
 */

export interface ProjectGroup {
  /** React key: the project's documentId, or a sentinel for the unprojected. */
  key: string;
  /** Null for tasks belonging to no project — "incidentals". */
  projectTitle: string | null;
  tasks: Task[];
}

export interface ReviewLists {
  /** Everything on your plate this cycle, grouped by project. */
  groups: ProjectGroup[];
}

const TOP_OF_MIND = 'top of mind';
const NO_PROJECT = '__incidentals__';

/**
 * Group tasks under the project they belong to.
 *
 * Forty pills in one wrapping block is a wall — you read it as a quantity
 * rather than as things. Under project headings the same forty become half a
 * dozen small, recognisable clusters, and the heading does the work the pills
 * were doing individually (each carried its project's name in muted text, which
 * is both redundant here and a large part of what made the wall dense).
 *
 * Order is first-appearance, so it inherits whatever order the caller
 * established — creation order, or frequency for the recurring list — rather
 * than imposing an alphabetical one nobody asked for. Incidentals sort last:
 * they're the leftovers by definition.
 */
export function groupByProject(tasks: Task[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();

  for (const task of tasks) {
    const key = task.project?.documentId ?? NO_PROJECT;
    const group = groups.get(key);
    if (group) group.tasks.push(task);
    else {
      groups.set(key, {
        key,
        projectTitle: task.project?.title ?? null,
        tasks: [task],
      });
    }
  }

  const ordered = [...groups.values()];
  const incidentals = ordered.findIndex((group) => group.key === NO_PROJECT);
  if (incidentals !== -1) ordered.push(...ordered.splice(incidentals, 1));
  return ordered;
}

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
 * Gather what this cycle is about, and group it.
 *
 * A task qualifies if it belongs to the top-of-mind project, is flagged `soon`,
 * or recurs — and it appears **once**, however many of those are true of it.
 * Everything else is left out: the review is a narrowing, and /todo is where the
 * whole list lives.
 *
 * Order within the pool is top-of-mind project first (its `soon` tasks leading),
 * then the flagged one-offs, then the recurring work from most to least
 * frequent. Grouping is stable, so that ordering survives into the groups, and
 * the top-of-mind project's group is moved to the front — it's the thing you
 * already decided matters this cycle.
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

  const groups = groupByProject([...topOfMindTasks, ...soon, ...recurring]);

  // The top-of-mind project leads. `groupByProject` keeps incidentals last, and
  // moving a group to the front doesn't disturb that.
  if (topOfMindProject) {
    const index = groups.findIndex((group) => group.key === topOfMindProject.documentId);
    if (index > 0) groups.unshift(...groups.splice(index, 1));
  }

  return { groups };
}
