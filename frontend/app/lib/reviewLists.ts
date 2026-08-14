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
 * Recurring tasks are the ones that **have come round by the end of the cycle** —
 * the review is a picture of what this week is going to ask for, and an annual
 * task due in November has nothing to say about a week in August. They were
 * included wholesale at first, which made the list a catalogue of everything
 * that recurs rather than of anything to do with the period on screen. Note the
 * one-sidedness: something whose date passed last week is still on your plate,
 * so it stays.
 *
 * Within that, they appear with no dates and no ordering by age. That is
 * deliberate and is the rule this whole feature is shaped around: if a task has
 * no due date then it has no due date, and ranking by how overdue something is
 * turns a planning tool into a productivity tool. A recurring task that came due
 * on Monday is presented exactly like one due on Friday.
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

/** The cycle being reviewed. Inclusive ISO dates, `YYYY-MM-DD`. */
export interface ReviewWindow {
  periodStart: string;
  periodEnd: string;
}

/**
 * Has this recurring task come round by the end of the cycle being reviewed?
 *
 * Recurring tasks used to be included wholesale, which put an annual task due in
 * November into a review of a week in August — a list of everything that recurs
 * rather than of what this cycle is going to ask for.
 *
 * The test is **one-sided**, and that's the point. A task is left out only when
 * it hasn't come round *yet*; one whose date has already gone by is still on
 * your plate and still belongs in the review. Excluding those as well — which an
 * earlier version did, reading "within the cycle" as both bounds — quietly
 * dropped last week's unfinished chores from the only page you plan on, while
 * they carried on showing up on /todo.
 *
 * **`dueDate` needs no separate test.** When a task has one, `displayDate` is
 * that date minus a positive offset (`recurrence.ts`), so it is never later; a
 * due date inside the window therefore implies a display date inside or before
 * it, and checking both would be two names for the same comparison.
 *
 * Compared as strings, deliberately. `displayDate` and the period bounds are all
 * `YYYY-MM-DD` wall-clock dates with no time and no zone, and lexicographic
 * order on that format *is* chronological order. Parsing them into instants to
 * compare them would introduce a timezone question where none exists — which is
 * the exact move that has produced three separate date bugs in this codebase.
 *
 * A task with no `displayDate` is kept, matching `groupTasksForLayout`: absent
 * means "nothing is holding this back", not "hide it".
 */
function hasComeRoundBy(task: Task, window: ReviewWindow | null): boolean {
  if (!window || !task.displayDate) return true;
  return task.displayDate.slice(0, 10) <= window.periodEnd;
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
export function buildReviewLists(
  tasks: Task[],
  window: ReviewWindow | null = null
): ReviewLists {
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
      // Everything that has come round by the end of this cycle, including what
      // came round before it. Nothing marks the older ones as late — see the
      // note at the top of the file about dates and ranking.
      if (hasComeRoundBy(task, window)) recurring.push(task);
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

/**
 * Split the grouped list into what's been picked and what hasn't.
 *
 * The picked come out flat, in the order they appear in the groups rather than
 * the order they were clicked: a list that reshuffles as you add to it makes you
 * re-find everything you already chose, and clicking one thing is not a
 * statement about the things picked before it.
 *
 * Groups emptied by the split are dropped, so a project whose every task is
 * picked doesn't leave a heading over nothing.
 */
export function partitionSelected(
  groups: ProjectGroup[],
  selected: Set<string>
): { picked: Task[]; remaining: ProjectGroup[] } {
  const picked: Task[] = [];
  const remaining: ProjectGroup[] = [];

  for (const group of groups) {
    const left: Task[] = [];
    for (const task of group.tasks) {
      if (selected.has(task.documentId)) picked.push(task);
      else left.push(task);
    }
    if (left.length > 0) remaining.push({ ...group, tasks: left });
  }

  return { picked, remaining };
}
