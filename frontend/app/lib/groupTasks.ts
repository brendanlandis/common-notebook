import type { Project, Task } from "@/app/types/index";
import { parseDate } from "@/app/lib/dateUtils";
import type { TimeZoneSettings } from "@/app/lib/timeZoneSettings";
import type { TaskGroup } from "@/app/lib/layoutTransformers";

export interface GroupedTasks {
  projects: Project[];
  // Kept (always empty) for the RawTaskData/layout-engine shape. Tasks are now
  // always attached to a project; anything project-less is an incidental.
  categoryGroups: TaskGroup[];
  incidentals: Task[];
  recurringProjects: Project[];
  recurringCategoryGroups: TaskGroup[];
  recurringIncidentals: Task[];
  allRecurringProjects: Project[];
  allRecurringCategoryGroups: TaskGroup[];
  allRecurringIncidentals: Task[];
}

// Group a flat list of tasks by project; project-less tasks become incidentals.
// `tasks` is assumed to already be visibility-filtered and phase-enriched.
// `projects` is the user's full project list (from /api/projects) and seeds the
// `projects` bucket, so a project with no tasks is still present — with an empty
// `tasks` array. That is what lets `/todo/project/<slug>` resolve a project you
// just made, and it replaces the `manualProjects` overlay that used to splice
// new projects in and lose them on the next refetch.
// `today` is used to filter recurring tasks by displayDate (unfiltered set is
// also returned for the recurring-review view).
export function groupTasksForLayout(
  tasks: Task[],
  projects: Project[],
  today: Date,
  settings: TimeZoneSettings
): GroupedTasks {
  const allRecurringTasksUnfiltered = tasks.filter((task) => task.isRecurring);

  const recurringTasks = tasks.filter((task) => {
    if (!task.isRecurring) return false;
    if (!task.displayDate) return true;
    const startDate = parseDate(task.displayDate, settings);
    return startDate <= today;
  });
  const nonRecurringTasks = tasks.filter((task) => !task.isRecurring);

  // Split a task list into project groups + project-less incidentals.
  //
  // `seed` is only for the `projects` bucket: it means "every project the user
  // has", where the recurring buckets mean "projects with recurring tasks due".
  // Seeding costs nothing downstream — the layout engine builds its columns from
  // tasks (`layoutTransformers.groupByProject`), so an empty project still
  // renders no column.
  const groupByProject = (list: Task[], seed: Project[] = []) => {
    const projectMap = new Map<string, Project>();
    const incidentals: Task[] = [];

    // Seeded first, so the authoritative record from /api/projects (which carries
    // the populated `world`) wins over a task's shallow `project` relation.
    seed.forEach((project) => {
      projectMap.set(project.documentId, { ...project, tasks: [] });
    });

    list.forEach((task) => {
      if (task.project) {
        const project = task.project as any;
        if (!projectMap.has(project.documentId)) {
          projectMap.set(project.documentId, { ...project, tasks: [] });
        }
        projectMap.get(project.documentId)!.tasks!.push(task);
      } else {
        incidentals.push(task);
      }
    });

    return { projects: Array.from(projectMap.values()), incidentals };
  };

  const nonRecurring = groupByProject(nonRecurringTasks, projects);
  const recurring = groupByProject(recurringTasks);
  const allRecurring = groupByProject(allRecurringTasksUnfiltered);

  return {
    projects: nonRecurring.projects,
    categoryGroups: [],
    incidentals: nonRecurring.incidentals,
    recurringProjects: recurring.projects,
    recurringCategoryGroups: [],
    recurringIncidentals: recurring.incidentals,
    allRecurringProjects: allRecurring.projects,
    allRecurringCategoryGroups: [],
    allRecurringIncidentals: allRecurring.incidentals,
  };
}
