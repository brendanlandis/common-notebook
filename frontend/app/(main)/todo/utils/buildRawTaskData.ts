import type { GroupedTasks } from "@/app/lib/groupTasks";
import type { RawTaskData } from "@/app/lib/layoutTransformers";

// Standard RawTaskData for the "live" task views (per-world, per-project, and
// most presets): the displayDate-filtered recurring sets, with none of the
// "done"/"invoicing" extras (completed/upcoming/long) or the unfiltered
// recurring set the recurring-review view needs. Those views build their own.
export function buildRawTaskData(grouped: GroupedTasks): RawTaskData {
  return {
    projects: grouped.projects,
    categoryGroups: grouped.categoryGroups,
    incidentals: grouped.incidentals,
    recurringProjects: grouped.recurringProjects,
    recurringCategoryGroups: grouped.recurringCategoryGroups,
    recurringIncidentals: grouped.recurringIncidentals,
  };
}
