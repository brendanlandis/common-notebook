import type { Project, Task, ProjectType, World, LayoutRuleset, RecurrenceType } from "@/app/types/index";
import { getTodayInEST, parseInEST, formatInEST, toISODateInEST, toZonedTime } from "@/app/lib/dateUtils";
import { getTimezone } from "@/app/lib/timezoneConfig";
import { getDayBoundaryHour } from "@/app/lib/dayBoundaryConfig";
import { getProjectPriority } from "@/app/lib/projectPriority";
import { getTaskProjectType } from "@/app/lib/taskProjectType";
import { addDays } from "date-fns";

export interface TaskGroup {
  title: string;
  tasks: Task[];
}

export type Section = Project | TaskGroup;

export interface TransformedLayout {
  recurringSections?: Section[];
  recurringIncidentals?: Task[];
  nonRecurringSections?: Section[];
  nonRecurringIncidentals?: Task[];
  allSections?: Section[];
  incidentals?: Task[];
  worldSections?: Map<World, {
    topOfMindAndCategories: Section[];
    priority: Section[];
    normal: Section[];
    later: Section[];
    incidentals: Task[];
  }>;
  combinedSections?: Section[];
  combinedIncidentals?: Task[];
  topOfMindSections?: Section[];
  topOfMindIncidentals?: Task[];
  nonRecurringNoProjectSections?: Section[];
  nonRecurringNoProjectIncidentals?: Task[];
  rouletteTasks?: Task[];
  upcomingTasksByDay?: TaskGroup[];
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

// Helper function to determine a task's world. World now lives on the task's
// project (every task has a project); project-less incidentals default to
// 'life stuff'.
function getTaskWorld(task: Task): World {
  return task.project?.world ?? "life stuff";
}

// Filter a single task based on ruleset
function shouldIncludeTask(task: Task, ruleset: LayoutRuleset, getWorld: (task: Task) => World): boolean {
  // The "stuff" world (wishlist / errands / in the mail / buy stuff projects)
  // only appears in the "stuff" view. This mirrors how the cross-world presets
  // exclude "day job" by omitting it from visibleWorlds, but is enforced here so
  // it also holds for the visibleWorlds: null views (later / done / recurring).
  if (getWorld(task) === "stuff" && ruleset.id !== "stuff") {
    return false;
  }

  // Filter by recurring/non-recurring
  if (task.isRecurring && !ruleset.showRecurring) {
    return false;
  }
  if (!task.isRecurring && !ruleset.showNonRecurring) {
    return false;
  }

  // Filter non-recurring tasks by displayDate
  // Recurring tasks are already filtered by displayDate at the source
  if (!task.isRecurring && task.displayDate) {
    const today = getTodayInEST();
    const displayDate = parseInEST(task.displayDate);
    if (displayDate > today) {
      return false;
    }
  }

  // Filter by world
  if (ruleset.visibleWorlds !== null) {
    const world = getWorld(task);
    if (!ruleset.visibleWorlds.includes(world)) {
      return false;
    }
  }

  // Filter by project (used by the per-project view)
  if (ruleset.visibleProjects) {
    const projectId = task.project?.documentId;
    if (!projectId || !ruleset.visibleProjects.includes(projectId)) {
      return false;
    }
  }

  // Filter by long only
  if (ruleset.longOnly && !task.long) {
    return false;
  }

  return true;
}

// Filter tasks from a section
function filterSectionTasks(section: Section, ruleset: LayoutRuleset, getWorld: (task: Task) => World): Section | null {
  const tasks = "documentId" in section ? section.tasks || [] : section.tasks;
  const filteredTasks = tasks.filter((task) => shouldIncludeTask(task, ruleset, getWorld));

  if (filteredTasks.length === 0) {
    return null;
  }

  if ("documentId" in section) {
    // It's a Project
    return {
      ...section,
      tasks: filteredTasks,
    };
  } else {
    // It's a TaskGroup
    return {
      ...section,
      tasks: filteredTasks,
    };
  }
}

// Sort tasks within a section
function sortTasks(tasks: Task[], sortBy: LayoutRuleset["sortBy"]): Task[] {
  const sorted = [...tasks];
  switch (sortBy) {
    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "creationDate":
      return sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      });
    case "dueDate":
      return sorted.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        // Put tasks without dates at the end
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return dateA - dateB;
      });
    case "completedAt":
      return sorted.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        // Put tasks without completedAt at the end
        if (!a.completedAt && !b.completedAt) return 0;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        // Sort descending (most recent first)
        return dateB - dateA;
      });
    default:
      return sorted;
  }
}

// Sort sections
function sortSections(sections: Section[], sortBy: LayoutRuleset["sortBy"]): Section[] {
  const sorted = [...sections];
  switch (sortBy) {
    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "creationDate":
      return sorted.sort((a, b) => {
        // For sections, use the first task's creation date, or section's createdAt if it's a project
        let dateA: number;
        let dateB: number;

        if ("documentId" in a) {
          // Project - use project's createdAt or first task's createdAt
          dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          if (a.tasks && a.tasks.length > 0) {
            const taskDate = new Date(a.tasks[0].createdAt).getTime();
            dateA = dateA === 0 ? taskDate : Math.min(dateA, taskDate);
          }
        } else {
          // TaskGroup - use first task's createdAt
          dateA = a.tasks.length > 0 ? new Date(a.tasks[0].createdAt).getTime() : 0;
        }

        if ("documentId" in b) {
          dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (b.tasks && b.tasks.length > 0) {
            const taskDate = new Date(b.tasks[0].createdAt).getTime();
            dateB = dateB === 0 ? taskDate : Math.min(dateB, taskDate);
          }
        } else {
          dateB = b.tasks.length > 0 ? new Date(b.tasks[0].createdAt).getTime() : 0;
        }

        return dateA - dateB;
      });
    case "dueDate":
      return sorted.sort((a, b) => {
        // For sections, use the earliest due date from tasks
        let dateA: number = Infinity;
        let dateB: number = Infinity;

        if ("documentId" in a && a.tasks) {
          a.tasks.forEach((task) => {
            if (task.dueDate) {
              const date = new Date(task.dueDate).getTime();
              dateA = Math.min(dateA, date);
            }
          });
        } else if (!("documentId" in a)) {
          a.tasks.forEach((task) => {
            if (task.dueDate) {
              const date = new Date(task.dueDate).getTime();
              dateA = Math.min(dateA, date);
            }
          });
        }

        if ("documentId" in b && b.tasks) {
          b.tasks.forEach((task) => {
            if (task.dueDate) {
              const date = new Date(task.dueDate).getTime();
              dateB = Math.min(dateB, date);
            }
          });
        } else if (!("documentId" in b)) {
          b.tasks.forEach((task) => {
            if (task.dueDate) {
              const date = new Date(task.dueDate).getTime();
              dateB = Math.min(dateB, date);
            }
          });
        }

        // Put sections without dates at the end
        if (dateA === Infinity && dateB === Infinity) return 0;
        if (dateA === Infinity) return 1;
        if (dateB === Infinity) return -1;
        return dateA - dateB;
      });
    default:
      return sorted;
  }
}

// Main transformation function
export function transformLayout(data: RawTaskData, ruleset: LayoutRuleset): TransformedLayout {
  // For recurring-review, skip the filtering and use the raw data directly
  if (ruleset.groupBy === "recurring-review") {
    // Collect ALL incomplete recurring tasks (ignore any filtering)
    const allRecurringTasks: Task[] = [];
    
    // Collect from recurring projects
    data.recurringProjects.forEach((project) => {
      if ("documentId" in project && project.tasks) {
        project.tasks.forEach((task) => {
          if (!task.completed) {
            allRecurringTasks.push(task);
          }
        });
      }
    });
    
    // Collect from recurring category groups
    data.recurringCategoryGroups.forEach((group) => {
      if (group.tasks) {
        group.tasks.forEach((task) => {
          if (!task.completed) {
            allRecurringTasks.push(task);
          }
        });
      }
    });
    
    // Collect recurring incidentals
    data.recurringIncidentals.forEach((task) => {
      if (!task.completed) {
        allRecurringTasks.push(task);
      }
    });
    
    // Group by recurrence type, but merge monthly date and monthly day
    const tasksByRecurrenceType = new Map<RecurrenceType | "monthly", Task[]>();
    allRecurringTasks.forEach((task) => {
      // Merge monthly date and monthly day into "monthly"
      const key = (task.recurrenceType === "monthly date" || task.recurrenceType === "monthly day") 
        ? "monthly" as const
        : task.recurrenceType;
      
      if (!tasksByRecurrenceType.has(key)) {
        tasksByRecurrenceType.set(key, []);
      }
      tasksByRecurrenceType.get(key)!.push(task);
    });
    
    // Define the order of recurrence types (with "monthly" instead of separate entries)
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
    
    // For each recurrence type, organize tasks by project, category, then incidentals
    const recurringReviewSectionsMap = new Map<RecurrenceType | "monthly", Section[]>();
    const recurringReviewIncidentalsMap = new Map<RecurrenceType | "monthly", Task[]>();
    
    recurrenceTypeOrder.forEach((recurrenceType) => {
      const tasksForType = tasksByRecurrenceType.get(recurrenceType);
      if (!tasksForType || tasksForType.length === 0) return;
      
      // For monthly, separate and sort by type first (monthly date, then monthly day)
      let sortedTasksForType = tasksForType;
      if (recurrenceType === "monthly") {
        const monthlyDateTasks = tasksForType.filter(t => t.recurrenceType === "monthly date");
        const monthlyDayTasks = tasksForType.filter(t => t.recurrenceType === "monthly day");
        sortedTasksForType = [...monthlyDateTasks, ...monthlyDayTasks];
      }
      
      // Group by project
      const projectMap = new Map<string, Project>();
      const tasksWithoutProjects: Task[] = [];
      
      sortedTasksForType.forEach((task) => {
        if (task.project) {
          const project = task.project as any;
          if (!projectMap.has(project.documentId)) {
            projectMap.set(project.documentId, {
              ...project,
              tasks: [],
            });
          }
          projectMap.get(project.documentId)!.tasks!.push(task);
        } else {
          tasksWithoutProjects.push(task);
        }
      });
      
      // Group tasks without projects by project type (project-less tasks are
      // incidentals now, so this is effectively empty, but kept for safety)
      const categoryMap = new Map<ProjectType, Task[]>();
      const incidentalTasks: Task[] = [];

      tasksWithoutProjects.forEach((task) => {
        const projectType = getTaskProjectType(task);
        if (projectType) {
          if (!categoryMap.has(projectType)) {
            categoryMap.set(projectType, []);
          }
          categoryMap.get(projectType)!.push(task);
        } else {
          incidentalTasks.push(task);
        }
      });
      
      // For monthly, we need to maintain the order (monthly date first, then monthly day)
      // within each project/category/incidental group
      // For "every x days", sort by interval first, then alphabetically
      const sortFunction = (tasks: Task[]) => {
        if (recurrenceType === "monthly") {
          const monthlyDateTasks = tasks.filter(t => t.recurrenceType === "monthly date");
          const monthlyDayTasks = tasks.filter(t => t.recurrenceType === "monthly day");
          return [
            ...sortTasks(monthlyDateTasks, "alphabetical"),
            ...sortTasks(monthlyDayTasks, "alphabetical"),
          ];
        }
        if (recurrenceType === "every x days") {
          // Sort by interval first, then alphabetically
          return [...tasks].sort((a, b) => {
            const intervalA = a.recurrenceInterval || 0;
            const intervalB = b.recurrenceInterval || 0;
            if (intervalA !== intervalB) {
              return intervalA - intervalB;
            }
            return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
          });
        }
        return sortTasks(tasks, "alphabetical");
      };
      
      // Sort projects alphabetically
      const projectsArray = Array.from(projectMap.values());
      const sortedProjects = projectsArray.map((project) => ({
        ...project,
        tasks: sortFunction(project.tasks || []),
      })).sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
      
      // Sort categories alphabetically
      const categoriesArray = Array.from(categoryMap.entries()).map(([category, tasks]) => ({
        title: category,
        tasks: sortFunction(tasks),
      })).sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
      
      // Combine: projects first, then categories
      const sections: Section[] = [...sortedProjects, ...categoriesArray];
      
      // Sort incidentals
      const sortedIncidentals = sortFunction(incidentalTasks);
      
      // Only add to maps if there's content
      if (sections.length > 0) {
        recurringReviewSectionsMap.set(recurrenceType, sections);
      }
      if (sortedIncidentals.length > 0) {
        recurringReviewIncidentalsMap.set(recurrenceType, sortedIncidentals);
      }
    });
    
    // Return the maps even if empty (for consistency with tests)
    return {
      recurringReviewSections: recurringReviewSectionsMap,
      recurringReviewIncidentals: recurringReviewIncidentalsMap.size > 0 ? recurringReviewIncidentalsMap : undefined,
    };
  }

  // Filter and prepare data for all other views
  const filteredRecurringProjects = data.recurringProjects
    .map((project) => filterSectionTasks(project, ruleset, getTaskWorld))
    .filter((section): section is Section => section !== null);

  const filteredRecurringCategoryGroups = data.recurringCategoryGroups
    .map((group) => filterSectionTasks(group, ruleset, getTaskWorld))
    .filter((group): group is TaskGroup => group !== null);

  const filteredRecurringIncidentals = data.recurringIncidentals.filter((task) =>
    shouldIncludeTask(task, ruleset, getTaskWorld)
  );

  const filteredProjects = data.projects
    .map((project) => filterSectionTasks(project, ruleset, getTaskWorld))
    .filter((section): section is Section => section !== null);

  const filteredCategoryGroups = data.categoryGroups
    .map((group) => filterSectionTasks(group, ruleset, getTaskWorld))
    .filter((group): group is TaskGroup => group !== null);

  const filteredIncidentals = data.incidentals.filter((task) =>
    shouldIncludeTask(task, ruleset, getTaskWorld)
  );

  // Sort tasks within sections
  const sortTasksInSection = (section: Section): Section => {
    if ("documentId" in section) {
      return {
        ...section,
        tasks: section.tasks ? sortTasks(section.tasks, ruleset.sortBy) : [],
      };
    } else {
      return {
        ...section,
        tasks: sortTasks(section.tasks, ruleset.sortBy),
      };
    }
  };

  const sortedRecurringProjects = filteredRecurringProjects.map(sortTasksInSection);
  const sortedRecurringCategoryGroups = filteredRecurringCategoryGroups.map(sortTasksInSection);
  const sortedRecurringIncidentals = sortTasks(filteredRecurringIncidentals, ruleset.sortBy);

  const sortedProjects = filteredProjects.map(sortTasksInSection);
  const sortedCategoryGroups = filteredCategoryGroups.map(sortTasksInSection);
  const sortedIncidentals = sortTasks(filteredIncidentals, ruleset.sortBy);

  // Apply grouping based on ruleset
  if (ruleset.groupBy === "recurring-separate") {
    return {
      recurringSections: sortSections(
        [...sortedRecurringProjects, ...sortedRecurringCategoryGroups],
        ruleset.sortBy
      ),
      recurringIncidentals:
        sortedRecurringIncidentals.length > 0 ? sortedRecurringIncidentals : undefined,
      nonRecurringSections: sortSections([...sortedProjects, ...sortedCategoryGroups], ruleset.sortBy),
      nonRecurringIncidentals: sortedIncidentals.length > 0 ? sortedIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "recurring-separate-world") {
    // Recurring sections first (unchanged)
    const recurringSections = sortSections(
      [...sortedRecurringProjects, ...sortedRecurringCategoryGroups],
      ruleset.sortBy
    );

    // Group non-recurring by world
    const nonRecurringWorldMap = new Map<World, {
      topOfMindAndCategories: Section[];
      priority: Section[];
      normal: Section[];
      later: Section[];
      incidentals: Task[];
    }>();

    // Initialize worlds
    const worlds: World[] = ["make music", "music admin", "life stuff", "day job", "computer"];
    worlds.forEach((world) => {
      nonRecurringWorldMap.set(world, {
        topOfMindAndCategories: [],
        priority: [],
        normal: [],
        later: [],
        incidentals: []
      });
    });

    // Group non-recurring projects by world and importance
    sortedProjects.forEach((project) => {
      if ("documentId" in project) {
        const world = project.world || "life stuff";
        const worldData = nonRecurringWorldMap.get(world);
        if (worldData) {
          const importance = project.importance || "normal";
          if (importance === "top of mind") {
            worldData.topOfMindAndCategories.push(project);
          } else if (importance === "later") {
            worldData.later.push(project);
          } else if (getProjectPriority(project.title) !== null) {
            worldData.priority.push(project);
          } else {
            worldData.normal.push(project);
          }
        }
      }
    });

    // Group non-recurring category groups by world (always go with top of mind)
    sortedCategoryGroups.forEach((group) => {
      if (group.tasks && group.tasks.length > 0) {
        const world = getTaskWorld(group.tasks[0]);
        const worldData = nonRecurringWorldMap.get(world);
        if (worldData) {
          worldData.topOfMindAndCategories.push(group);
        }
      }
    });

    // Process non-recurring incidentals - add to topOfMindAndCategories
    const incidentalsByWorld = new Map<World, Task[]>();
    sortedIncidentals.forEach((task) => {
      const world = getTaskWorld(task);
      if (!incidentalsByWorld.has(world)) {
        incidentalsByWorld.set(world, []);
      }
      incidentalsByWorld.get(world)!.push(task);
    });

    // Sort sections within each world, with special ordering for topOfMindAndCategories
    nonRecurringWorldMap.forEach((worldData, world) => {
      // Sort top of mind and categories: top of mind projects first, then categories
      const topOfMindProjects: Section[] = [];
      const categoryGroups: Section[] = [];
      
      worldData.topOfMindAndCategories.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project (should be top of mind since we filtered by importance)
          topOfMindProjects.push(section);
        } else {
          // It's a TaskGroup (category)
          categoryGroups.push(section);
        }
      });
      
      // Sort each group
      const sortedTopOfMind = sortSections(topOfMindProjects, ruleset.sortBy);
      const sortedCategories = sortSections(categoryGroups, ruleset.sortBy);
      
      // Combine: top of mind projects, then categories
      worldData.topOfMindAndCategories = [...sortedTopOfMind, ...sortedCategories];
      
      // Add incidentals (they'll be rendered with topOfMindAndCategories via the incidentals prop)
      const worldIncidentals = incidentalsByWorld.get(world) || [];
      worldData.incidentals = sortTasks(worldIncidentals, ruleset.sortBy);
      
      // Sort priority sections by priority number ascending, creation date as tiebreaker
      // (sortSections gives the tiebreaker order; Array.sort is stable so pN groups keep it)
      worldData.priority = sortSections(worldData.priority, ruleset.sortBy).sort(
        (a, b) => getProjectPriority((a as Project).title)! - getProjectPriority((b as Project).title)!
      );

      // Sort normal and later sections
      worldData.normal = sortSections(worldData.normal, ruleset.sortBy);
      worldData.later = sortSections(worldData.later, ruleset.sortBy);
    });

    return {
      recurringSections,
      recurringIncidentals:
        sortedRecurringIncidentals.length > 0 ? sortedRecurringIncidentals : undefined,
      worldSections: nonRecurringWorldMap,
    };
  } else if (ruleset.groupBy === "merged") {
    // Merge recurring and non-recurring projects
    const mergedProjects = new Map<string, Project>();

    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project) {
        const existing = mergedProjects.get(project.documentId);
        if (existing) {
          mergedProjects.set(project.documentId, {
            ...existing,
            tasks: [...(existing.tasks || []), ...(project.tasks || [])],
          });
        } else {
          mergedProjects.set(project.documentId, { ...project });
        }
      }
    });

    // Merge recurring and non-recurring category groups
    const mergedCategoryGroups = new Map<string, TaskGroup>();

    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      const existing = mergedCategoryGroups.get(group.title);
      if (existing) {
        mergedCategoryGroups.set(group.title, {
          ...existing,
          tasks: [...existing.tasks, ...(group.tasks || [])],
        });
      } else {
        mergedCategoryGroups.set(group.title, { 
          title: group.title,
          tasks: group.tasks || []
        });
      }
    });

    // Merge incidentals
    const mergedIncidentals = [...sortedRecurringIncidentals, ...sortedIncidentals];

    // Combine all sections and sort
    const allSections: Section[] = sortSections(
      [...Array.from(mergedProjects.values()), ...Array.from(mergedCategoryGroups.values())],
      ruleset.sortBy
    );

    // Sort merged incidentals
    const sortedMergedIncidentals = sortTasks(mergedIncidentals, ruleset.sortBy);

    return {
      allSections,
      incidentals: sortedMergedIncidentals.length > 0 ? sortedMergedIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "single-section") {
    // Combine all tasks from all sources into a single flat list
    const allTasks: Task[] = [];

    // Collect tasks from all projects (recurring and non-recurring)
    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project && project.tasks) {
        allTasks.push(...project.tasks);
      }
    });

    // Collect tasks from all category groups (recurring and non-recurring)
    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      if (group.tasks) {
        allTasks.push(...group.tasks);
      }
    });

    // Collect all incidentals (recurring and non-recurring)
    allTasks.push(...sortedRecurringIncidentals, ...sortedIncidentals);

    // Sort all tasks together
    const sortedAllTasks = sortTasks(allTasks, ruleset.sortBy);

    // Return as a single TaskGroup section
    return {
      allSections: [
        {
          title: "all tasks",
          tasks: sortedAllTasks,
        },
      ],
    };
  } else if (ruleset.groupBy === "world") {
    // Group by world, merging recurring and non-recurring
    const worldMap = new Map<World, {
      topOfMindAndCategories: Section[];
      priority: Section[];
      normal: Section[];
      later: Section[];
      incidentals: Task[];
    }>();

    // Initialize worlds
    const worlds: World[] = ["life stuff", "music admin", "make music", "day job", "computer"];
    worlds.forEach((world) => {
      worldMap.set(world, {
        topOfMindAndCategories: [],
        priority: [],
        normal: [],
        later: [],
        incidentals: []
      });
    });

    // Merge recurring and non-recurring projects by documentId
    const mergedProjects = new Map<string, Project>();
    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project) {
        const existing = mergedProjects.get(project.documentId);
        if (existing) {
          mergedProjects.set(project.documentId, {
            ...existing,
            tasks: [...(existing.tasks || []), ...(project.tasks || [])],
          });
        } else {
          mergedProjects.set(project.documentId, { ...project });
        }
      }
    });

    // Merge recurring and non-recurring category groups by title
    const mergedCategoryGroups = new Map<string, TaskGroup>();
    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      const existing = mergedCategoryGroups.get(group.title);
      if (existing) {
        mergedCategoryGroups.set(group.title, {
          ...existing,
          tasks: [...existing.tasks, ...(group.tasks || [])],
        });
      } else {
        mergedCategoryGroups.set(group.title, { 
          title: group.title,
          tasks: group.tasks || []
        });
      }
    });

    // Group merged projects and category groups by world and importance
    mergedProjects.forEach((project) => {
      const world = project.world || "life stuff";
      const worldData = worldMap.get(world);
      if (worldData) {
        const importance = project.importance || "normal";
        if (importance === "top of mind") {
          worldData.topOfMindAndCategories.push(project);
        } else if (importance === "later") {
          worldData.later.push(project);
        } else if (getProjectPriority(project.title) !== null) {
          worldData.priority.push(project);
        } else {
          worldData.normal.push(project);
        }
      }
    });

    // Group merged category groups by world (always go with top of mind)
    mergedCategoryGroups.forEach((group) => {
      if (group.tasks && group.tasks.length > 0) {
        const world = getTaskWorld(group.tasks[0]);
        const worldData = worldMap.get(world);
        if (worldData) {
          worldData.topOfMindAndCategories.push(group);
        }
      }
    });

    // Process all incidentals (recurring and non-recurring) - add to topOfMindAndCategories
    const incidentalsByWorld = new Map<World, Task[]>();
    [...sortedRecurringIncidentals, ...sortedIncidentals].forEach((task) => {
      const world = getTaskWorld(task);
      if (!incidentalsByWorld.has(world)) {
        incidentalsByWorld.set(world, []);
      }
      incidentalsByWorld.get(world)!.push(task);
    });

    // Sort sections within each world, with special ordering for topOfMindAndCategories
    worldMap.forEach((worldData, world) => {
      // Sort top of mind and categories: top of mind projects first, then categories
      const topOfMindProjects: Section[] = [];
      const categoryGroups: Section[] = [];
      
      worldData.topOfMindAndCategories.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project (should be top of mind since we filtered by importance)
          topOfMindProjects.push(section);
        } else {
          // It's a TaskGroup (category)
          categoryGroups.push(section);
        }
      });
      
      // Sort each group
      const sortedTopOfMind = sortSections(topOfMindProjects, ruleset.sortBy);
      const sortedCategories = sortSections(categoryGroups, ruleset.sortBy);
      
      // Combine: top of mind projects, then categories
      worldData.topOfMindAndCategories = [...sortedTopOfMind, ...sortedCategories];
      
      // Add incidentals (they'll be rendered with topOfMindAndCategories via the incidentals prop)
      const worldIncidentals = incidentalsByWorld.get(world) || [];
      worldData.incidentals = sortTasks(worldIncidentals, ruleset.sortBy);
      
      // Sort priority sections by priority number ascending, creation date as tiebreaker
      // (sortSections gives the tiebreaker order; Array.sort is stable so pN groups keep it)
      worldData.priority = sortSections(worldData.priority, ruleset.sortBy).sort(
        (a, b) => getProjectPriority((a as Project).title)! - getProjectPriority((b as Project).title)!
      );

      // Sort normal and later sections
      worldData.normal = sortSections(worldData.normal, ruleset.sortBy);
      worldData.later = sortSections(worldData.later, ruleset.sortBy);
    });

    return {
      worldSections: worldMap,
    };
  } else if (ruleset.groupBy === "project") {
    // Group by project - similar to merged but keep projects separate
    const allSections: Section[] = sortSections(
      [...sortedRecurringProjects, ...sortedProjects, ...sortedRecurringCategoryGroups, ...sortedCategoryGroups],
      ruleset.sortBy
    );
    const allIncidentals = sortTasks(
      [...sortedRecurringIncidentals, ...sortedIncidentals],
      ruleset.sortBy
    );

    return {
      allSections,
      incidentals: allIncidentals.length > 0 ? allIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "category") {
    // Group by project type - merge project tasks into projectType groups.
    // (Used by the "stuff" view; the four stuff projects each map 1:1 to a
    // projectType, so this reproduces the old category grouping.)
    const categoryMap = new Map<ProjectType | "incidentals", Task[]>();

    // Collect all tasks from projects and category groups
    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project && project.tasks) {
        project.tasks.forEach((task) => {
          const projectType = getTaskProjectType(task);
          if (projectType) {
            if (!categoryMap.has(projectType)) {
              categoryMap.set(projectType, []);
            }
            categoryMap.get(projectType)!.push(task);
          } else {
            if (!categoryMap.has("incidentals")) {
              categoryMap.set("incidentals", []);
            }
            categoryMap.get("incidentals")!.push(task);
          }
        });
      }
    });

    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      if (group.tasks) {
        group.tasks.forEach((task) => {
          if (!categoryMap.has(group.title as ProjectType)) {
            categoryMap.set(group.title as ProjectType, []);
          }
          categoryMap.get(group.title as ProjectType)!.push(task);
        });
      }
    });

    // Add incidentals
    [...sortedRecurringIncidentals, ...sortedIncidentals].forEach((task) => {
      if (!categoryMap.has("incidentals")) {
        categoryMap.set("incidentals", []);
      }
      categoryMap.get("incidentals")!.push(task);
    });

    // Convert to TaskGroup sections with special sorting for "stuff" view
    if (ruleset.id === "stuff") {
      // For "stuff" view, split wishlist by wishListCategory and order sections
      const regularCategoryGroups: TaskGroup[] = [];
      const wishlistCategoryGroups: TaskGroup[] = [];
      
      Array.from(categoryMap.entries()).forEach(([category, tasks]) => {
        if (category === "wishlist") {
          // Split wishlist items by wishListCategory (normalized)
          const wishlistCategoryMap = new Map<string, Task[]>();
          
          tasks.forEach((task) => {
            // Normalize wishListCategory: lowercase and trim
            const normalizedCategory = task.wishListCategory
              ? task.wishListCategory.trim().toLowerCase()
              : "uncategorized";
            
            if (!wishlistCategoryMap.has(normalizedCategory)) {
              wishlistCategoryMap.set(normalizedCategory, []);
            }
            wishlistCategoryMap.get(normalizedCategory)!.push(task);
          });
          
          // Create groups for each wishlist category
          wishlistCategoryMap.forEach((categoryTasks, normalizedCategory) => {
            // Sort by price: items without prices first, then items with prices (low to high)
            const sortedTasks = [...categoryTasks].sort((a, b) => {
              const priceA = a.price;
              const priceB = b.price;
              
              // If both have prices, sort by price (low to high)
              if (priceA !== null && priceB !== null) {
                return priceA - priceB;
              }
              
              // If one is null and one has a price, null comes first
              if (priceA === null && priceB !== null) {
                return -1;
              }
              if (priceA !== null && priceB === null) {
                return 1;
              }
              
              // Both are null, maintain order
              return 0;
            });
            
            // Use the original (non-normalized) category name from the first task for display
            const displayName = categoryTasks[0]?.wishListCategory?.trim() || "uncategorized";
            
            wishlistCategoryGroups.push({
              title: displayName,
              tasks: sortedTasks,
            });
          });
          
          // Sort wishlist category groups alphabetically
          wishlistCategoryGroups.sort((a, b) => a.title.localeCompare(b.title));
        } else {
          // Handle regular categories (buy stuff, in the mail, errands)
          let sortedTasks: Task[];
          
          if (category === "buy stuff") {
            // Sort by creationDate (oldest first)
            sortedTasks = [...tasks].sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateA - dateB;
            });
          } else {
            // Use default sorting for other categories (e.g., "in the mail", "errands")
            sortedTasks = sortTasks(tasks, ruleset.sortBy);
          }
          
          regularCategoryGroups.push({
            title: category === "incidentals" ? "incidentals" : category,
            tasks: sortedTasks,
          });
        }
      });
      
      // Order: "buy stuff", "in the mail", "errands", then wishlist categories
      const orderedSections: TaskGroup[] = [];
      
      // Add "buy stuff" first if it exists
      const buyStuffGroup = regularCategoryGroups.find(g => g.title === "buy stuff");
      if (buyStuffGroup) {
        orderedSections.push(buyStuffGroup);
      }
      
      // Add "in the mail" second if it exists
      const inTheMailGroup = regularCategoryGroups.find(g => g.title === "in the mail");
      if (inTheMailGroup) {
        orderedSections.push(inTheMailGroup);
      }
      
      // Add "errands" third if it exists
      const errandsGroup = regularCategoryGroups.find(g => g.title === "errands");
      if (errandsGroup) {
        orderedSections.push(errandsGroup);
      }
      
      // Add all wishlist category groups
      orderedSections.push(...wishlistCategoryGroups);
      
      return {
        allSections: orderedSections,
      };
    } else {
      // For non-stuff views, use the original logic
    const categoryGroups: TaskGroup[] = Array.from(categoryMap.entries())
        .map(([category, tasks]) => {
          const sortedTasks = sortTasks(tasks, ruleset.sortBy);
          return {
        title: category === "incidentals" ? "incidentals" : category,
            tasks: sortedTasks,
          };
        })
      .filter((group) => group.tasks.length > 0);

    return {
      allSections: sortSections(categoryGroups, ruleset.sortBy),
    };
    }
  } else if (ruleset.groupBy === "good-morning") {
    // Track which tasks have already been included to prevent duplicates
    const includedTaskIds = new Set<string>();

    // Find the "top of mind" project from original unfiltered data
    const topOfMindProject = [...data.projects, ...data.recurringProjects].find(
      (project) => "documentId" in project && project.importance === "top of mind"
    );
    const topOfMindProjectId = topOfMindProject && "documentId" in topOfMindProject ? topOfMindProject.documentId : null;

    // Helper to check if a section is the top of mind project
    const isTopOfMindSection = (section: Section): boolean => {
      return "documentId" in section && section.documentId === topOfMindProjectId;
    };

    // Helper to filter out "day job" world
    const filterDayJob = (task: Task): boolean => {
      const world = getTaskWorld(task);
      return world !== "day job";
    };

    // Helper to filter and track tasks from a section
    const filterSectionTasksForGoodMorning = (
      section: Section,
      taskFilter: (task: Task) => boolean
    ): Section | null => {
      const tasks = "documentId" in section ? section.tasks || [] : section.tasks;
      // Filter tasks that match the criteria and haven't been included yet
      const filteredTasks = tasks.filter((task) =>
        taskFilter(task) && !includedTaskIds.has(task.documentId)
      );

      // Track the included tasks
      filteredTasks.forEach((task) => includedTaskIds.add(task.documentId));

      if (filteredTasks.length === 0) {
        return null;
      }

      if ("documentId" in section) {
        return {
          ...section,
          tasks: filteredTasks,
        };
      } else {
        return {
          ...section,
          tasks: filteredTasks,
        };
      }
    };

    // Helper to filter and track incidentals
    const filterAndTrackIncidentals = (
      tasks: Task[],
      taskFilter: (task: Task) => boolean
    ): Task[] => {
      const filtered = tasks.filter((task) =>
        taskFilter(task) && !includedTaskIds.has(task.documentId)
      );
      // Track the included tasks
      filtered.forEach((task) => includedTaskIds.add(task.documentId));
      return filtered;
    };

    // Helper to re-sort tasks within a section by dueDate
    const reSortSectionTasksByDueDate = (section: Section): Section => {
      if ("documentId" in section) {
        return {
          ...section,
          tasks: section.tasks ? sortTasks(section.tasks, "dueDate") : [],
        };
      } else {
        return {
          ...section,
          tasks: sortTasks(section.tasks, "dueDate"),
        };
      }
    };

    // Helper to merge sections, combining category groups with the same title
    const mergeSections = (sections: Section[], sortBy: LayoutRuleset["sortBy"] = "creationDate"): Section[] => {
      const projectMap = new Map<string, Project>();
      const categoryGroupMap = new Map<string, TaskGroup>();

      sections.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project - keep separate by documentId
          const project = section as Project;
          projectMap.set(project.documentId, project);
        } else {
          // It's a TaskGroup - merge by title
          const group = section as TaskGroup;
          const existing = categoryGroupMap.get(group.title);
          if (existing) {
            // Merge tasks from both groups and sort
            const mergedTasks = [...existing.tasks, ...group.tasks];
            categoryGroupMap.set(group.title, {
              ...group,
              tasks: sortTasks(mergedTasks, sortBy),
            });
          } else {
            categoryGroupMap.set(group.title, group);
          }
        }
      });

      return [...Array.from(projectMap.values()), ...Array.from(categoryGroupMap.values())];
    };

    // Helper to merge sections, combining projects by documentId and category groups by title
    const mergeSectionsWithProjectMerging = (sections: Section[], sortBy: LayoutRuleset["sortBy"] = "creationDate"): Section[] => {
      const projectMap = new Map<string, Project>();
      const categoryGroupMap = new Map<string, TaskGroup>();

      sections.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project - merge by documentId, combining tasks
          const project = section as Project;
          const existing = projectMap.get(project.documentId);
          if (existing) {
            // Merge tasks from both projects
            const mergedTasks = [...(existing.tasks || []), ...(project.tasks || [])];
            projectMap.set(project.documentId, {
              ...project,
              tasks: mergedTasks,
            });
          } else {
            projectMap.set(project.documentId, project);
          }
        } else {
          // It's a TaskGroup - merge by title
          const group = section as TaskGroup;
          const existing = categoryGroupMap.get(group.title);
          if (existing) {
            // Merge tasks from both groups and sort
            const mergedTasks = [...existing.tasks, ...group.tasks];
            categoryGroupMap.set(group.title, {
              ...group,
              tasks: sortTasks(mergedTasks, sortBy),
            });
          } else {
            categoryGroupMap.set(group.title, group);
          }
        }
      });

      // Sort tasks within each merged project: those with dueDate by dueDate, others by creationDate
      projectMap.forEach((project, documentId) => {
        if (project.tasks) {
          const tasksWithDueDate = project.tasks.filter(t => t.dueDate);
          const tasksWithoutDueDate = project.tasks.filter(t => !t.dueDate);
          const sortedWithDueDate = sortTasks(tasksWithDueDate, "dueDate");
          const sortedWithoutDueDate = sortTasks(tasksWithoutDueDate, "creationDate");
          projectMap.set(documentId, {
            ...project,
            tasks: [...sortedWithDueDate, ...sortedWithoutDueDate],
          });
        }
      });

      return [...Array.from(projectMap.values()), ...Array.from(categoryGroupMap.values())];
    };

    // 1. Recurring Section: All visible recurring tasks
    const recurringSections: Section[] = [];
    const recurringIncidentals: Task[] = [];

    // Process recurring projects and category groups - all recurring tasks
    [...sortedRecurringProjects, ...sortedRecurringCategoryGroups].forEach((section) => {
      const filtered = filterSectionTasksForGoodMorning(section, (task) => 
        filterDayJob(task) && task.isRecurring
      );
      if (filtered) {
        recurringSections.push(filtered);
      }
    });

    // Process recurring incidentals - all recurring tasks
    const filteredRecurringIncidentals = filterAndTrackIncidentals(
      sortedRecurringIncidentals,
      (task) => filterDayJob(task) && task.isRecurring
    );
    recurringIncidentals.push(...filteredRecurringIncidentals);

    // 2. Soon + Top of Mind Section: Non-recurring "soon" tasks + "top of mind" project tasks
    const soonAndTopOfMindSections: Section[] = [];
    const soonAndTopOfMindIncidentals: Task[] = [];

    // Non-recurring projects and category groups - tasks with soon=true
    [...data.projects, ...data.categoryGroups].forEach((section) => {
      const tasks = "documentId" in section ? section.tasks || [] : section.tasks;
      const filteredTasks = tasks.filter((task) => {
        // Apply displayDate filtering for non-recurring tasks
        if (task.displayDate) {
          const today = getTodayInEST();
          const displayDate = parseInEST(task.displayDate);
          if (displayDate > today) {
            return false;
          }
        }

        return !task.isRecurring &&
          task.soon === true &&
          !includedTaskIds.has(task.documentId);
      });
      
      filteredTasks.forEach((task) => includedTaskIds.add(task.documentId));
      
      if (filteredTasks.length > 0) {
        const sortedTasks = sortTasks(filteredTasks, ruleset.sortBy);
        if ("documentId" in section) {
          soonAndTopOfMindSections.push({
            ...section,
            tasks: sortedTasks,
          });
        } else {
          soonAndTopOfMindSections.push({
            ...section,
            tasks: sortedTasks,
          });
        }
      }
    });

    // Non-recurring incidentals - tasks with soon=true
    const filteredNonRecurringIncidentalsSoon = data.incidentals.filter((task) => {
      // Apply displayDate filtering for non-recurring tasks
      if (task.displayDate) {
        const today = getTodayInEST();
        const displayDate = parseInEST(task.displayDate);
        if (displayDate > today) {
          return false;
        }
      }
      
      return !task.isRecurring &&
        task.soon === true && 
        !includedTaskIds.has(task.documentId);
    });
    filteredNonRecurringIncidentalsSoon.forEach((task) => includedTaskIds.add(task.documentId));
    soonAndTopOfMindIncidentals.push(...filteredNonRecurringIncidentalsSoon);

    // Add all non-recurring tasks from the "top of mind" project
    if (topOfMindProjectId) {
      // Use ORIGINAL unfiltered data to get the top of mind project from ANY world (including day job)
      // Don't filter by world - top of mind projects always show up even if they're in "day job"
      data.projects.forEach((project) => {
        if ("documentId" in project && project.documentId === topOfMindProjectId) {
          const tasks = project.tasks || [];
          const filteredTasks = tasks.filter((task) => {
            // Apply displayDate filtering for non-recurring tasks
            if (task.displayDate) {
              const today = getTodayInEST();
              const displayDate = parseInEST(task.displayDate);
              if (displayDate > today) {
                return false;
              }
            }

            return !task.isRecurring &&
              !includedTaskIds.has(task.documentId);
          });
          
          filteredTasks.forEach((task) => includedTaskIds.add(task.documentId));
          
          if (filteredTasks.length > 0) {
            const sortedTasks = sortTasks(filteredTasks, ruleset.sortBy);
            soonAndTopOfMindSections.push({
              ...project,
              tasks: sortedTasks,
            });
          }
        }
      });
    }

    // Merge sections to combine projects by documentId and category groups with the same title
    const mergedRecurringSections = mergeSectionsWithProjectMerging(recurringSections, "creationDate");
    const mergedSoonAndTopOfMindSections = mergeSections(soonAndTopOfMindSections, "creationDate");

    // Sort all sections and incidentals
    const finalRecurringSections = sortSections(mergedRecurringSections, "creationDate");
    const finalRecurringIncidentals = sortTasks(recurringIncidentals, "creationDate");
    const finalSoonAndTopOfMindSections = sortSections(mergedSoonAndTopOfMindSections, "creationDate");
    const finalSoonAndTopOfMindIncidentals = sortTasks(soonAndTopOfMindIncidentals, "creationDate");

    return {
      combinedSections: finalRecurringSections.length > 0 ? finalRecurringSections : undefined,
      combinedIncidentals: finalRecurringIncidentals.length > 0 ? finalRecurringIncidentals : undefined,
      topOfMindSections: finalSoonAndTopOfMindSections.length > 0 ? finalSoonAndTopOfMindSections : undefined,
      topOfMindIncidentals: finalSoonAndTopOfMindIncidentals.length > 0 ? finalSoonAndTopOfMindIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "chores") {
    // Flat list of chore-type projects (projectType === "chores"). Every chore
    // now lives in a project; day-job chores are already excluded upstream by
    // the preset's visibleWorlds filter, so no further world filtering is needed.
    const choreProjects = [...sortedRecurringProjects, ...sortedProjects].filter(
      (section): section is Project =>
        "documentId" in section && (section as Project).projectType === "chores"
    );

    const sortedNonRecurringNoProjectSections = sortSections(choreProjects, ruleset.sortBy);

    return {
      nonRecurringNoProjectSections: sortedNonRecurringNoProjectSections.length > 0 ? sortedNonRecurringNoProjectSections : undefined,
    };
  } else if (ruleset.groupBy === "roulette") {
    // Collect all non-completed tasks excluding "day job" world
    const allTasks: Task[] = [];

    // Helper to filter out "day job" world
    const filterDayJob = (task: Task): boolean => {
      const world = getTaskWorld(task);
      return world !== "day job";
    };

    // Collect tasks from recurring projects
    sortedRecurringProjects.forEach((project) => {
      if ("documentId" in project && project.tasks) {
        project.tasks.forEach((task) => {
          if (!task.completed && filterDayJob(task) && shouldIncludeTask(task, ruleset, getTaskWorld)) {
            allTasks.push(task);
          }
        });
      }
    });

    // Collect tasks from recurring category groups
    sortedRecurringCategoryGroups.forEach((group) => {
      if (group.tasks) {
        group.tasks.forEach((task) => {
          if (!task.completed && filterDayJob(task) && shouldIncludeTask(task, ruleset, getTaskWorld)) {
            allTasks.push(task);
          }
        });
      }
    });

    // Collect recurring incidentals
    sortedRecurringIncidentals.forEach((task) => {
      if (!task.completed && filterDayJob(task) && shouldIncludeTask(task, ruleset, getTaskWorld)) {
        allTasks.push(task);
      }
    });

    // Collect tasks from non-recurring projects
    sortedProjects.forEach((project) => {
      if ("documentId" in project && project.tasks) {
        project.tasks.forEach((task) => {
          if (!task.completed && filterDayJob(task) && shouldIncludeTask(task, ruleset, getTaskWorld)) {
            allTasks.push(task);
          }
        });
      }
    });

    // Collect tasks from non-recurring category groups
    sortedCategoryGroups.forEach((group) => {
      if (group.tasks) {
        group.tasks.forEach((task) => {
          if (!task.completed && filterDayJob(task) && shouldIncludeTask(task, ruleset, getTaskWorld)) {
            allTasks.push(task);
          }
        });
      }
    });

    // Collect non-recurring incidentals
    sortedIncidentals.forEach((task) => {
      if (!task.completed && filterDayJob(task) && shouldIncludeTask(task, ruleset, getTaskWorld)) {
        allTasks.push(task);
      }
    });

    return {
      rouletteTasks: allTasks,
    };
  } else if (ruleset.groupBy === "later") {
    // Filter projects by importance === "later" (both recurring and non-recurring)
    // Note: filteredRecurringProjects and filteredProjects already respect displayDate via filterSectionTasks
    const laterRecurringProjects = filteredRecurringProjects.filter((project) => {
      if ("documentId" in project) {
        return project.importance === "later";
      }
      return false;
    });

    const laterProjects = filteredProjects.filter((project) => {
      if ("documentId" in project) {
        return project.importance === "later";
      }
      return false;
    });

    // Merge recurring and non-recurring projects by documentId
    const mergedLaterProjects = new Map<string, Project>();

    [...laterRecurringProjects, ...laterProjects].forEach((project) => {
      if ("documentId" in project) {
        const existing = mergedLaterProjects.get(project.documentId);
        if (existing) {
          mergedLaterProjects.set(project.documentId, {
            ...existing,
            tasks: [...(existing.tasks || []), ...(project.tasks || [])],
          });
        } else {
          mergedLaterProjects.set(project.documentId, { ...project });
        }
      }
    });

    // Sort tasks within each project
    const sortedLaterProjects = Array.from(mergedLaterProjects.values()).map((project) => {
      return {
        ...project,
        tasks: project.tasks ? sortTasks(project.tasks, ruleset.sortBy) : [],
      };
    });

    // Sort projects
    const allSections: Section[] = sortSections(sortedLaterProjects, ruleset.sortBy);

    return {
      allSections,
    };
  } else if (ruleset.groupBy === "done") {
    // Collect all completed tasks, excluding "in the mail" and "errands" project types
    const completedTasks = (data.completedTasks || []).filter((task) =>
      getTaskProjectType(task) !== "in the mail" && getTaskProjectType(task) !== "errands"
    );

    // Group tasks by completion date (day)
    const tasksByDate = new Map<string, Task[]>();

    completedTasks.forEach((task) => {
      if (task.completedAt) {
        // Parse the completedAt timestamp in configured timezone
        const completedDate = toZonedTime(new Date(task.completedAt), getTimezone());
        
        // Get the hour in the configured timezone (0-23)
        // After toZonedTime, use UTC methods to access timezone-adjusted values
        const hour = completedDate.getUTCHours();
        
        // If before day boundary hour, group with previous day
        let adjustedDate = new Date(completedDate);
        if (hour < getDayBoundaryHour()) {
          adjustedDate.setDate(adjustedDate.getDate() - 1);
        }
        
        const dateKey = toISODateInEST(adjustedDate);
        
        if (!tasksByDate.has(dateKey)) {
          tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey)!.push(task);
      }
    });

    // Add "worked on" entries for long tasks with work sessions
    // Use the dedicated longTasksWithSessions array passed from the API
    const longTasks = data.longTasksWithSessions || [];

    longTasks.forEach((task) => {
      if (task.workSessions && task.workSessions.length > 0) {
        task.workSessions.forEach((session) => {
          // Create a virtual "worked on" entry for each work session
          const workedOnEntry: Task = {
            ...task,
            id: -1, // Use negative ID to indicate this is a virtual entry
            documentId: `${task.documentId}-worked-${session.date}`,
            title: task.title, // Keep original title, "worked on" prefix added in display
            completed: false, // Mark as not completed to differentiate from actual completions
            completedAt: session.timestamp, // Use the actual timestamp from the work session
          };

          if (!tasksByDate.has(session.date)) {
            tasksByDate.set(session.date, []);
          }
          tasksByDate.get(session.date)!.push(workedOnEntry);
        });
      }
    });

    // Calculate the cutoff date (30 days ago from today)
    const nowInEST = toZonedTime(new Date(), getTimezone());
    // After toZonedTime, use UTC methods to access timezone-adjusted values
    const hour = nowInEST.getUTCHours();
    let todayDate = new Date(getTodayInEST());
    if (hour < getDayBoundaryHour()) {
      // If before day boundary hour, "today" is actually yesterday's date
      todayDate.setDate(todayDate.getDate() - 1);
    }
    
    const thirtyDaysAgo = new Date(todayDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 29 days ago + today = 30 days total
    const cutoffDateISO = toISODateInEST(thirtyDaysAgo);

    // Create sections for each date, sorted by date descending (most recent first)
    // Filter to only include dates within the last 30 days
    const dateSections = Array.from(tasksByDate.entries())
      .filter(([dateKey]) => {
        // Only include dates that are >= 30 days ago
        return dateKey >= cutoffDateISO;
      })
      .sort(([dateA], [dateB]) => {
        // Sort dates descending (most recent first)
        return dateB.localeCompare(dateA);
      });

    const finalDateSections: TaskGroup[] = dateSections
      .map(([dateKey, tasks]) => {
        // Format the date for display
        const date = parseInEST(dateKey);
        
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        
        let dateTitle: string;
        const dateISO = toISODateInEST(date);
        const todayISO = toISODateInEST(todayDate);
        const yesterdayISO = toISODateInEST(yesterdayDate);
        
        if (dateISO === todayISO) {
          dateTitle = "today";
        } else if (dateISO === yesterdayISO) {
          dateTitle = "yesterday";
        } else {
          // Format as "wed dec 1" or similar (abbreviated weekday and month)
          dateTitle = formatInEST(date, "EEE MM/d").toLowerCase();
        }

        // Sort tasks within this day by completedAt ascending (earliest first)
        const sortedTasks = tasks.sort((a, b) => {
          const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          // Put tasks without completedAt at the end
          if (!a.completedAt && !b.completedAt) return 0;
          if (!a.completedAt) return 1;
          if (!b.completedAt) return -1;
          // Sort ascending (earliest first)
          return dateA - dateB;
        });

        return {
          title: dateTitle,
          tasks: sortedTasks,
        };
      });

    // Process upcoming tasks and group by day
    const upcomingTasks = data.upcomingTasks || [];
    const upcomingByDate = new Map<string, Task[]>();

    upcomingTasks.forEach((task) => {
      if (task.displayDate) {
        const dateKey = task.displayDate; // Already in YYYY-MM-DD format
        
        if (!upcomingByDate.has(dateKey)) {
          upcomingByDate.set(dateKey, []);
        }
        upcomingByDate.get(dateKey)!.push(task);
      }
    });

    // Calculate tomorrow through 4 days out
    // Use actual today (not adjusted by 4am cutoff) for upcoming tasks
    const actualToday = getTodayInEST();

    // Create sections for the next 4 days
    const upcomingDaySections: TaskGroup[] = [];
    for (let i = 0; i < 4; i++) {
      // Use addDays to properly handle date arithmetic
      const currentDate = addDays(actualToday, i + 1);
      const dateKey = toISODateInEST(currentDate);
      const tasks = upcomingByDate.get(dateKey) || [];

      // Format the date for display
      let dateTitle: string;
      if (i === 0) {
        dateTitle = "tomorrow";
      } else {
        // Format as day name (e.g., "wednesday", "thursday")
        dateTitle = formatInEST(currentDate, "EEEE").toLowerCase();
      }

      upcomingDaySections.push({
        title: dateTitle,
        tasks: tasks,
      });
    }

    return {
      allSections: finalDateSections,
      upcomingTasksByDay: upcomingDaySections,
    };
  } else if (ruleset.groupBy === "invoicing") {
    // Like "done" but scoped to "day job" world, 60-day window, no upcoming
    const completedTasks = (data.completedTasks || []).filter((task) => {
      if (getTaskProjectType(task) === "in the mail" || getTaskProjectType(task) === "errands") return false;
      return getTaskWorld(task) === "day job";
    });

    // Group tasks by completion date (day)
    const tasksByDate = new Map<string, Task[]>();

    completedTasks.forEach((task) => {
      if (task.completedAt) {
        const completedDate = toZonedTime(new Date(task.completedAt), getTimezone());
        const hour = completedDate.getUTCHours();
        let adjustedDate = new Date(completedDate);
        if (hour < getDayBoundaryHour()) {
          adjustedDate.setDate(adjustedDate.getDate() - 1);
        }
        const dateKey = toISODateInEST(adjustedDate);
        if (!tasksByDate.has(dateKey)) {
          tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey)!.push(task);
      }
    });

    // Add "worked on" entries for long tasks with work sessions (day job only)
    const longTasks = (data.longTasksWithSessions || []).filter((task) => getTaskWorld(task) === "day job");

    longTasks.forEach((task) => {
      if (task.workSessions && task.workSessions.length > 0) {
        task.workSessions.forEach((session) => {
          const workedOnEntry: Task = {
            ...task,
            id: -1,
            documentId: `${task.documentId}-worked-${session.date}`,
            title: task.title,
            completed: false,
            completedAt: session.timestamp,
          };
          if (!tasksByDate.has(session.date)) {
            tasksByDate.set(session.date, []);
          }
          tasksByDate.get(session.date)!.push(workedOnEntry);
        });
      }
    });

    // Calculate the cutoff date (60 days ago from today)
    const nowInEST = toZonedTime(new Date(), getTimezone());
    const hour = nowInEST.getUTCHours();
    let todayDate = new Date(getTodayInEST());
    if (hour < getDayBoundaryHour()) {
      todayDate.setDate(todayDate.getDate() - 1);
    }

    const sixtyDaysAgo = new Date(todayDate);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 59); // 59 days ago + today = 60 days total
    const cutoffDateISO = toISODateInEST(sixtyDaysAgo);

    const dateSections = Array.from(tasksByDate.entries())
      .filter(([dateKey]) => dateKey >= cutoffDateISO)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));

    const finalDateSections: TaskGroup[] = dateSections.map(([dateKey, tasks]) => {
      const date = parseInEST(dateKey);
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);

      let dateTitle: string;
      const dateISO = toISODateInEST(date);
      const todayISO = toISODateInEST(todayDate);
      const yesterdayISO = toISODateInEST(yesterdayDate);

      if (dateISO === todayISO) {
        dateTitle = "today";
      } else if (dateISO === yesterdayISO) {
        dateTitle = "yesterday";
      } else {
        dateTitle = formatInEST(date, "EEE MM/d").toLowerCase();
      }

      const sortedTasks = tasks.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        if (!a.completedAt && !b.completedAt) return 0;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return dateA - dateB;
      });

      return {
        title: dateTitle,
        tasks: sortedTasks,
      };
    });

    return {
      allSections: finalDateSections,
    };
  }

  // Fallback
  return {};
}

