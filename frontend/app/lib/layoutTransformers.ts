import type {
  Project,
  Task,
  ProjectType,
  World,
  LayoutRuleset,
  FilterSet,
  ImportanceFilter,
  RecurrenceType,
} from "@/app/types/index";
import { getToday, parseDate, formatInTimezone, toISODate, shiftISODate } from "@/app/lib/dateUtils";
import { getEffectiveDayForTimestamp } from "@/app/lib/dayBoundaryHelpers";
import type { TimeZoneSettings } from "@/app/lib/timeZoneSettings";
import { getProjectPriority } from "@/app/lib/projectPriority";
import { getTaskProjectType } from "@/app/lib/taskProjectType";
import { resolveVisibleWorldIds, STUFF_SYSTEM_KEY } from "@/app/lib/worlds";

// ── Output shapes ────────────────────────────────────────────────────────────

export interface TaskGroup {
  title: string;
  tasks: Task[];
}

export type Section = Project | TaskGroup;

// One rendered group of a `projects` view: the columns (project or, for the
// stuff view, projectType/wishlist categories) a section contributes, in tier
// order, plus its no-world incidentals. `name` is the section label (omitted for
// single-section views, which render without a heading).
export interface ProjectGroup {
  name?: string;
  columns: Section[];
  incidentals: Task[];
}

export interface TransformedLayout {
  // layout: "projects"
  projectGroups?: ProjectGroup[];
  // layout: "chronological" (flat, oldest → newest; the component groups by month)
  chronologicalTasks?: Task[];
  // layout: "roulette"
  rouletteTasks?: Task[];
  // codePreset: "done"
  doneSections?: TaskGroup[];
  upcomingTasksByDay?: TaskGroup[];
  // codePreset: "recurring"
  recurringReviewSections?: Map<RecurrenceType | "monthly", Section[]>;
  recurringReviewIncidentals?: Map<RecurrenceType | "monthly", Task[]>;
}

export interface RawTaskData {
  projects: Project[];
  categoryGroups: TaskGroup[];
  incidentals: Task[];
  recurringProjects: Project[];
  recurringCategoryGroups: TaskGroup[];
  recurringIncidentals: Task[];
  completedTasks?: Task[];
  upcomingTasks?: Task[];
  longTasksWithSessions?: Task[];
}

// ── Task helpers ─────────────────────────────────────────────────────────────

// A task's world lives on its project (or null for project-less / no-world tasks).
function getTaskWorld(task: Task): World | null {
  return task.project?.world ?? null;
}

// Effective importance tier (precedence: soon/top-of-mind → later → regular).
type Tier = "soonAndTopOfMind" | "regular" | "later";
function taskTier(task: Task): Tier {
  if (task.soon || task.project?.importance === "top of mind") return "soonAndTopOfMind";
  if (task.project?.importance === "later") return "later";
  return "regular";
}

// Each ImportanceFilter is a contiguous range over the ordered tiers; `any`
// keeps everything (null).
const IMPORTANCE_RANGES: Record<ImportanceFilter, Tier[] | null> = {
  any: null,
  soonAndTopOfMind: ["soonAndTopOfMind"],
  "soonAndTopOfMind-regular": ["soonAndTopOfMind", "regular"],
  regular: ["regular"],
  "regular-later": ["regular", "later"],
  later: ["later"],
};

function importanceAllows(filter: ImportanceFilter, task: Task): boolean {
  const range = IMPORTANCE_RANGES[filter];
  return range === null || range.includes(taskTier(task));
}

interface SectionContext {
  visibleWorldIds: Set<string>;
  showIncidentals: boolean; // only worldMode === "all" surfaces no-world tasks
}

// Does a task belong in a section? ANDs the section's filter set, plus the
// ruleset-level project scope (per-project route) and the global displayDate
// gate (future-dated tasks hidden everywhere except the recurring review).
function taskMatchesSection(
  task: Task,
  section: FilterSet,
  ctx: SectionContext,
  ruleset: LayoutRuleset,
  settings: TimeZoneSettings
): boolean {
  // Recurrence
  if (section.recurrence === "recurring" && !task.isRecurring) return false;
  if (section.recurrence === "nonRecurring" && task.isRecurring) return false;

  // Global "hidden until" gate: a future displayDate hides a task in every view.
  // Recurring tasks are pre-filtered by displayDate at the source (groupTasks).
  if (!ruleset.ignoreDisplayDate && !task.isRecurring && task.displayDate) {
    if (parseDate(task.displayDate, settings) > getToday(settings)) return false;
  }

  // World scope — skipped when the view is project-scoped (the per-project
  // route keeps a specific project regardless of its world).
  if (ruleset.visibleProjects) {
    const projectId = task.project?.documentId;
    if (!projectId || !ruleset.visibleProjects.includes(projectId)) return false;
  } else {
    const world = getTaskWorld(task);
    const worldOk = world ? ctx.visibleWorldIds.has(world.documentId) : ctx.showIncidentals;
    if (!worldOk) return false;
  }

  // Effective-tier importance
  if (!importanceAllows(section.importance, task)) return false;

  // Project type (only `chores` narrows; stuff types are never a section filter)
  if (section.projectType === "chores" && getTaskProjectType(task) !== "chores") return false;

  // Long-only
  if (section.longOnly && !task.long) return false;

  return true;
}

// Every task across the raw sources (each appears exactly once — a project with
// mixed tasks is split across `projects`/`recurringProjects`).
function allTasksFrom(data: RawTaskData): Task[] {
  const tasks: Task[] = [];
  const pushProjects = (projects: Project[]) =>
    projects.forEach((p) => p.tasks && tasks.push(...p.tasks));
  const pushGroups = (groups: TaskGroup[]) => groups.forEach((g) => g.tasks && tasks.push(...g.tasks));
  pushProjects(data.projects);
  pushProjects(data.recurringProjects);
  pushGroups(data.categoryGroups);
  pushGroups(data.recurringCategoryGroups);
  tasks.push(...data.incidentals, ...data.recurringIncidentals);
  return tasks;
}

// The tasks a section claims, in raw order, skipping any already claimed by an
// earlier (topmost) section — the generalized good-morning dedup.
function collectSectionTasks(
  allTasks: Task[],
  section: FilterSet,
  ruleset: LayoutRuleset,
  worlds: World[],
  claimed: Set<string>,
  settings: TimeZoneSettings
): Task[] {
  const ctx: SectionContext = {
    visibleWorldIds: resolveVisibleWorldIds(section.worldMode, section.worldIds, worlds),
    showIncidentals: section.worldMode === "all",
  };
  const matched: Task[] = [];
  for (const task of allTasks) {
    if (claimed.has(task.documentId)) continue;
    if (!taskMatchesSection(task, section, ctx, ruleset, settings)) continue;
    claimed.add(task.documentId);
    matched.push(task);
  }
  return matched;
}

// ── Sorting ──────────────────────────────────────────────────────────────────

type SortOrder = "alphabetical" | "creationDate" | "dueDate" | "completedAt";

function sortTasks(tasks: Task[], order: SortOrder): Task[] {
  const sorted = [...tasks];
  switch (order) {
    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "creationDate":
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "dueDate":
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    case "completedAt":
      return sorted.sort((a, b) => {
        if (!a.completedAt && !b.completedAt) return 0;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      });
    default:
      return sorted;
  }
}

// Creation timestamp of a section: its own createdAt (project) or its first
// task's, whichever is earlier.
function sectionCreation(s: Section): number {
  let t = "documentId" in s && s.createdAt ? new Date(s.createdAt).getTime() : 0;
  const tasks = "documentId" in s ? s.tasks : s.tasks;
  if (tasks && tasks.length > 0) {
    const first = new Date(tasks[0].createdAt).getTime();
    t = t === 0 ? first : Math.min(t, first);
  }
  return t;
}

function sortSectionsByCreation(sections: Section[]): Section[] {
  return [...sections].sort((a, b) => sectionCreation(a) - sectionCreation(b));
}

// ── Column grouping ──────────────────────────────────────────────────────────

// Order project columns by importance tier: top of mind → priority (pN) →
// normal → later, creation date within each tier (pN by number, then creation).
// Exported so the Manage Projects drawer can order each world's projects the
// same way the task views do.
export function orderProjectColumns(projects: Project[]): Project[] {
  const topOfMind: Project[] = [];
  const priority: Project[] = [];
  const normal: Project[] = [];
  const later: Project[] = [];
  for (const p of projects) {
    const importance = p.importance || "normal";
    if (importance === "top of mind") topOfMind.push(p);
    else if (importance === "later") later.push(p);
    else if (getProjectPriority(p.title) !== null) priority.push(p);
    else normal.push(p);
  }
  const byCreation = (list: Project[]) => sortSectionsByCreation(list) as Project[];
  // Priority: creation order first, then a stable sort by pN so ties keep creation order.
  const sortedPriority = (byCreation(priority)).sort(
    (a, b) => getProjectPriority(a.title)! - getProjectPriority(b.title)!
  );
  return [...byCreation(topOfMind), ...sortedPriority, ...byCreation(normal), ...byCreation(later)];
}

// Group matched tasks into project columns (tier-ordered) + no-world incidentals.
function groupByProject(tasks: Task[]): { columns: Section[]; incidentals: Task[] } {
  const projectMap = new Map<string, Project>();
  const incidentals: Task[] = [];
  for (const task of tasks) {
    const project = task.project;
    if (project && project.documentId) {
      let col = projectMap.get(project.documentId);
      if (!col) {
        col = { ...project, tasks: [] };
        projectMap.set(project.documentId, col);
      }
      col.tasks!.push(task);
    } else {
      incidentals.push(task);
    }
  }
  // Fixed default: tasks within a column ordered oldest → newest.
  projectMap.forEach((p) => {
    p.tasks = sortTasks(p.tasks || [], "creationDate");
  });
  return {
    columns: orderProjectColumns([...projectMap.values()]),
    incidentals: sortTasks(incidentals, "creationDate"),
  };
}

// The stuff view groups tasks by projectType instead of by project, splits the
// wishlist by wishListCategory (price-sorted), and orders the columns
// buy stuff → in the mail → errands → wishlist categories.
function groupByStuffCategory(tasks: Task[]): { columns: Section[]; incidentals: Task[] } {
  const byType = new Map<ProjectType, Task[]>();
  for (const task of tasks) {
    const type = getTaskProjectType(task);
    if (!type) continue; // no-world incidentals aren't shown in the stuff view
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(task);
  }

  const columns: TaskGroup[] = [];

  const pushRegular = (type: ProjectType, order: SortOrder) => {
    const t = byType.get(type);
    if (t && t.length > 0) columns.push({ title: type, tasks: sortTasks(t, order) });
  };
  pushRegular("buy stuff", "creationDate");
  pushRegular("in the mail", "creationDate");
  pushRegular("errands", "creationDate");

  const wishlist = byType.get("wishlist");
  if (wishlist && wishlist.length > 0) {
    const byCategory = new Map<string, Task[]>();
    for (const task of wishlist) {
      const key = task.wishListCategory ? task.wishListCategory.trim().toLowerCase() : "uncategorized";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(task);
    }
    const wishlistGroups: TaskGroup[] = [];
    byCategory.forEach((catTasks) => {
      // Items without a price first, then ascending price.
      const sorted = [...catTasks].sort((a, b) => {
        if (a.price !== null && b.price !== null) return a.price - b.price;
        if (a.price === null && b.price !== null) return -1;
        if (a.price !== null && b.price === null) return 1;
        return 0;
      });
      const displayName = catTasks[0]?.wishListCategory?.trim() || "uncategorized";
      wishlistGroups.push({ title: displayName, tasks: sorted });
    });
    wishlistGroups.sort((a, b) => a.title.localeCompare(b.title));
    columns.push(...wishlistGroups);
  }

  return { columns, incidentals: [] };
}

// ── Layout: projects ─────────────────────────────────────────────────────────

function transformProjects(data: RawTaskData, ruleset: LayoutRuleset, worlds: World[], settings: TimeZoneSettings): TransformedLayout {
  const isStuff = ruleset.systemKey === STUFF_SYSTEM_KEY;
  const allTasks = allTasksFrom(data);
  const claimed = new Set<string>();
  const projectGroups: ProjectGroup[] = [];

  for (const section of ruleset.sections) {
    const matched = collectSectionTasks(allTasks, section, ruleset, worlds, claimed, settings);
    const grouped = isStuff ? groupByStuffCategory(matched) : groupByProject(matched);
    projectGroups.push({
      name: section.name || undefined,
      columns: grouped.columns,
      incidentals: grouped.incidentals,
    });
  }

  return { projectGroups };
}

// ── Layout: chronological ────────────────────────────────────────────────────

function transformChronological(data: RawTaskData, ruleset: LayoutRuleset, worlds: World[], settings: TimeZoneSettings): TransformedLayout {
  const section = ruleset.sections[0];
  if (!section) return { chronologicalTasks: [] };
  const matched = collectSectionTasks(allTasksFrom(data), section, ruleset, worlds, new Set(), settings);
  return { chronologicalTasks: sortTasks(matched, "creationDate") };
}

// ── Layout: roulette ─────────────────────────────────────────────────────────

function transformRoulette(data: RawTaskData, ruleset: LayoutRuleset, worlds: World[], settings: TimeZoneSettings): TransformedLayout {
  const section = ruleset.sections[0];
  if (!section) return { rouletteTasks: [] };
  const matched = collectSectionTasks(allTasksFrom(data), section, ruleset, worlds, new Set(), settings);
  return { rouletteTasks: matched.filter((t) => !t.completed) };
}

// ── Code preset: recurring review ────────────────────────────────────────────

function transformRecurringReview(data: RawTaskData): TransformedLayout {
  // ALL incomplete recurring tasks, ignoring every filter (incl. displayDate).
  const allRecurringTasks: Task[] = [];
  data.recurringProjects.forEach((project) => {
    if ("documentId" in project && project.tasks) {
      project.tasks.forEach((task) => !task.completed && allRecurringTasks.push(task));
    }
  });
  data.recurringCategoryGroups.forEach((group) => {
    group.tasks?.forEach((task) => !task.completed && allRecurringTasks.push(task));
  });
  data.recurringIncidentals.forEach((task) => !task.completed && allRecurringTasks.push(task));

  // Group by recurrence type, merging "monthly date"/"monthly day" → "monthly".
  const tasksByRecurrenceType = new Map<RecurrenceType | "monthly", Task[]>();
  allRecurringTasks.forEach((task) => {
    const key =
      task.recurrenceType === "monthly date" || task.recurrenceType === "monthly day"
        ? ("monthly" as const)
        : task.recurrenceType;
    if (!tasksByRecurrenceType.has(key)) tasksByRecurrenceType.set(key, []);
    tasksByRecurrenceType.get(key)!.push(task);
  });

  const recurrenceTypeOrder: (RecurrenceType | "monthly")[] = [
    "daily",
    "every x days",
    "weekly",
    "biweekly",
    "monthly",
    "annually",
    "full moon",
    "new moon",
    "every season",
    "winter solstice",
    "spring equinox",
    "summer solstice",
    "autumn equinox",
  ];

  const recurringReviewSectionsMap = new Map<RecurrenceType | "monthly", Section[]>();
  const recurringReviewIncidentalsMap = new Map<RecurrenceType | "monthly", Task[]>();

  recurrenceTypeOrder.forEach((recurrenceType) => {
    const tasksForType = tasksByRecurrenceType.get(recurrenceType);
    if (!tasksForType || tasksForType.length === 0) return;

    const sortFunction = (tasks: Task[]) => {
      if (recurrenceType === "monthly") {
        const monthlyDate = tasks.filter((t) => t.recurrenceType === "monthly date");
        const monthlyDay = tasks.filter((t) => t.recurrenceType === "monthly day");
        return [...sortTasks(monthlyDate, "alphabetical"), ...sortTasks(monthlyDay, "alphabetical")];
      }
      if (recurrenceType === "every x days") {
        return [...tasks].sort((a, b) => {
          const intervalA = a.recurrenceInterval || 0;
          const intervalB = b.recurrenceInterval || 0;
          if (intervalA !== intervalB) return intervalA - intervalB;
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
      }
      return sortTasks(tasks, "alphabetical");
    };

    const projectMap = new Map<string, Project>();
    const incidentalTasks: Task[] = [];
    tasksForType.forEach((task) => {
      if (task.project) {
        const project = task.project;
        if (!projectMap.has(project.documentId)) projectMap.set(project.documentId, { ...project, tasks: [] });
        projectMap.get(project.documentId)!.tasks!.push(task);
      } else {
        incidentalTasks.push(task);
      }
    });

    const sortedProjects = Array.from(projectMap.values())
      .map((project) => ({ ...project, tasks: sortFunction(project.tasks || []) }))
      .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));

    const sortedIncidentals = sortFunction(incidentalTasks);

    if (sortedProjects.length > 0) recurringReviewSectionsMap.set(recurrenceType, sortedProjects);
    if (sortedIncidentals.length > 0) recurringReviewIncidentalsMap.set(recurrenceType, sortedIncidentals);
  });

  return {
    recurringReviewSections: recurringReviewSectionsMap,
    recurringReviewIncidentals: recurringReviewIncidentalsMap.size > 0 ? recurringReviewIncidentalsMap : undefined,
  };
}

// ── Code preset: done ────────────────────────────────────────────────────────

function transformDone(data: RawTaskData, settings: TimeZoneSettings): TransformedLayout {
  // Completed tasks, excluding "in the mail" / "errands" project types.
  const completedTasks = (data.completedTasks || []).filter(
    (task) => getTaskProjectType(task) !== "in the mail" && getTaskProjectType(task) !== "errands"
  );

  // `completedAt` is a real instant; getEffectiveDayForTimestamp applies the day boundary
  // against the user's wall clock. Don't re-inline that here: hand-rolling it read the hour
  // off a zoned Date with getUTCHours(), which tests the boundary against a clock shifted by
  // the UTC offset — with a 3am boundary in New York it filed 00:00-02:59 a day late and
  // 20:00-22:59 a day early.
  const tasksByDate = new Map<string, Task[]>();
  completedTasks.forEach((task) => {
    if (task.completedAt) {
      const dateKey = getEffectiveDayForTimestamp(new Date(task.completedAt), settings);
      if (!tasksByDate.has(dateKey)) tasksByDate.set(dateKey, []);
      tasksByDate.get(dateKey)!.push(task);
    }
  });

  // "Worked on" virtual entries for long tasks with work sessions.
  (data.longTasksWithSessions || []).forEach((task) => {
    if (task.workSessions && task.workSessions.length > 0) {
      task.workSessions.forEach((session) => {
        const workedOnEntry: Task = {
          ...task,
          id: -1,
          documentId: `${task.documentId}-worked-${session.date}`,
          completed: false,
          completedAt: session.timestamp,
        };
        if (!tasksByDate.has(session.date)) tasksByDate.set(session.date, []);
        tasksByDate.get(session.date)!.push(workedOnEntry);
      });
    }
  });

  // 30-day window (today + 29 prior), most-recent first. Every key here is an effective-day
  // ISO string, so the window and the labels compare as strings — no calendar arithmetic on
  // instants, which would silently run in the machine's zone rather than the user's.
  const todayKey = getEffectiveDayForTimestamp(new Date(), settings);
  const yesterdayKey = shiftISODate(todayKey, -1);
  const cutoffDateISO = shiftISODate(todayKey, -29);

  const doneSections: TaskGroup[] = Array.from(tasksByDate.entries())
    .filter(([dateKey]) => dateKey >= cutoffDateISO)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([dateKey, tasks]) => {
      let dateTitle: string;
      if (dateKey === todayKey) dateTitle = "today";
      else if (dateKey === yesterdayKey) dateTitle = "yesterday";
      else dateTitle = formatInTimezone(parseDate(dateKey, settings), "EEE MM/d", settings).toLowerCase();

      const sortedTasks = tasks.sort((a, b) => {
        if (!a.completedAt && !b.completedAt) return 0;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      });
      return { title: dateTitle, tasks: sortedTasks };
    });

  // Upcoming: the next 4 days, grouped by day.
  const upcomingByDate = new Map<string, Task[]>();
  (data.upcomingTasks || []).forEach((task) => {
    if (task.displayDate) {
      if (!upcomingByDate.has(task.displayDate)) upcomingByDate.set(task.displayDate, []);
      upcomingByDate.get(task.displayDate)!.push(task);
    }
  });
  // Day arithmetic on the ISO string, not on the instant — addDays(actualToday, i)
  // ran in the machine's calendar, so on a UTC server serving a New York user the
  // labels drifted a day (Nov 1 emitted twice, Nov 4 dropped) during fall-back week.
  const todayISO = toISODate(getToday(settings), settings);
  const upcomingTasksByDay: TaskGroup[] = [];
  for (let i = 0; i < 4; i++) {
    const dateKey = shiftISODate(todayISO, i + 1);
    const tasks = upcomingByDate.get(dateKey) || [];
    const dateTitle = i === 0 ? "tomorrow" : formatInTimezone(parseDate(dateKey, settings), "EEEE", settings).toLowerCase();
    upcomingTasksByDay.push({ title: dateTitle, tasks });
  }

  return { doneSections, upcomingTasksByDay };
}

// ── Entry ────────────────────────────────────────────────────────────────────

export function transformLayout(
  data: RawTaskData,
  ruleset: LayoutRuleset,
  settings: TimeZoneSettings,
  worlds: World[] = []
): TransformedLayout {
  // Code presets win over `layout`.
  if (ruleset.codePreset === "recurring") return transformRecurringReview(data);
  if (ruleset.codePreset === "done") return transformDone(data, settings);

  switch (ruleset.layout) {
    case "chronological":
      return transformChronological(data, ruleset, worlds, settings);
    case "roulette":
      return transformRoulette(data, ruleset, worlds, settings);
    case "projects":
    default:
      return transformProjects(data, ruleset, worlds, settings);
  }
}
