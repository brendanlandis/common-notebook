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
// `today` is used to filter recurring tasks by displayDate (unfiltered set is
// also returned for the recurring-review view).
export function groupTasksForLayout(
  tasks: Task[],
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
  const groupByProject = (list: Task[]) => {
    const projectMap = new Map<string, Project>();
    const incidentals: Task[] = [];

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

  const nonRecurring = groupByProject(nonRecurringTasks);
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
