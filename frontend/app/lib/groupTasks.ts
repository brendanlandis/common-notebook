import type { Project, Task, TaskCategory } from "@/app/types/index";
import { parseInEST } from "@/app/lib/dateUtils";
import type { TaskGroup } from "@/app/lib/layoutTransformers";

export interface GroupedTasks {
  projects: Project[];
  categoryGroups: TaskGroup[];
  incidentals: Task[];
  recurringProjects: Project[];
  recurringCategoryGroups: TaskGroup[];
  recurringIncidentals: Task[];
  allRecurringProjects: Project[];
  allRecurringCategoryGroups: TaskGroup[];
  allRecurringIncidentals: Task[];
}

// Pure function: group a flat list of tasks into the shape RawTaskData expects.
// `tasks` is assumed to already be visibility-filtered and phase-enriched.
// `today` is used to filter recurring tasks by displayDate (unfiltered set is
// also returned for the recurring-review view).
export function groupTasksForLayout(tasks: Task[], today: Date): GroupedTasks {
  const allRecurringTasksUnfiltered = tasks.filter((task) => task.isRecurring);

  const recurringTasks = tasks.filter((task) => {
    if (!task.isRecurring) return false;
    if (!task.displayDate) return true;
    const startDate = parseInEST(task.displayDate);
    return startDate <= today;
  });
  const nonRecurringTasks = tasks.filter((task) => !task.isRecurring);

  // Non-recurring: group by project, then by category, then incidentals
  const projectMap = new Map<string, Project>();
  const tasksWithoutProjects: Task[] = [];

  nonRecurringTasks.forEach((task) => {
    if (task.project) {
      const project = task.project as any;
      if (!projectMap.has(project.documentId)) {
        projectMap.set(project.documentId, { ...project, tasks: [] });
      }
      projectMap.get(project.documentId)!.tasks!.push(task);
    } else {
      tasksWithoutProjects.push(task);
    }
  });

  const categoryMap = new Map<TaskCategory, Task[]>();
  const incidentalTasks: Task[] = [];

  tasksWithoutProjects.forEach((task) => {
    if (task.category) {
      if (!categoryMap.has(task.category)) {
        categoryMap.set(task.category, []);
      }
      categoryMap.get(task.category)!.push(task);
    } else {
      incidentalTasks.push(task);
    }
  });

  // Recurring (filtered): group by project, then by category, then incidentals
  const recurringProjectMap = new Map<string, Project>();
  const recurringTasksWithoutProjects: Task[] = [];

  recurringTasks.forEach((task) => {
    if (task.project) {
      const project = task.project as any;
      if (!recurringProjectMap.has(project.documentId)) {
        recurringProjectMap.set(project.documentId, { ...project, tasks: [] });
      }
      recurringProjectMap.get(project.documentId)!.tasks!.push(task);
    } else {
      recurringTasksWithoutProjects.push(task);
    }
  });

  const recurringCategoryMap = new Map<TaskCategory, Task[]>();
  const recurringIncidentalTasks: Task[] = [];

  recurringTasksWithoutProjects.forEach((task) => {
    if (task.category) {
      if (!recurringCategoryMap.has(task.category)) {
        recurringCategoryMap.set(task.category, []);
      }
      recurringCategoryMap.get(task.category)!.push(task);
    } else {
      recurringIncidentalTasks.push(task);
    }
  });

  // Recurring (unfiltered): same shape, used for the recurring-review view
  const allRecurringProjectMap = new Map<string, Project>();
  const allRecurringTasksWithoutProjects: Task[] = [];

  allRecurringTasksUnfiltered.forEach((task) => {
    if (task.project) {
      const project = task.project as any;
      if (!allRecurringProjectMap.has(project.documentId)) {
        allRecurringProjectMap.set(project.documentId, { ...project, tasks: [] });
      }
      allRecurringProjectMap.get(project.documentId)!.tasks!.push(task);
    } else {
      allRecurringTasksWithoutProjects.push(task);
    }
  });

  const allRecurringCategoryMap = new Map<TaskCategory, Task[]>();
  const allRecurringIncidentalTasks: Task[] = [];

  allRecurringTasksWithoutProjects.forEach((task) => {
    if (task.category) {
      if (!allRecurringCategoryMap.has(task.category)) {
        allRecurringCategoryMap.set(task.category, []);
      }
      allRecurringCategoryMap.get(task.category)!.push(task);
    } else {
      allRecurringIncidentalTasks.push(task);
    }
  });

  return {
    projects: Array.from(projectMap.values()),
    categoryGroups: Array.from(categoryMap.entries()).map(([title, tasks]) => ({
      title,
      tasks,
    })),
    incidentals: incidentalTasks,
    recurringProjects: Array.from(recurringProjectMap.values()),
    recurringCategoryGroups: Array.from(recurringCategoryMap.entries()).map(
      ([title, tasks]) => ({ title, tasks })
    ),
    recurringIncidentals: recurringIncidentalTasks,
    allRecurringProjects: Array.from(allRecurringProjectMap.values()),
    allRecurringCategoryGroups: Array.from(allRecurringCategoryMap.entries()).map(
      ([title, tasks]) => ({ title, tasks })
    ),
    allRecurringIncidentals: allRecurringIncidentalTasks,
  };
}
