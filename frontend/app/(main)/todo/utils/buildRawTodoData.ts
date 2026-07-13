import type { GroupedTodos } from "@/app/lib/groupTodos";
import type { RawTodoData } from "@/app/lib/layoutTransformers";

// Standard RawTodoData for the "live" todo views (per-world, per-project, and
// most presets): the displayDate-filtered recurring sets, with none of the
// "done"/"invoicing" extras (completed/upcoming/long) or the unfiltered
// recurring set the recurring-review view needs. Those views build their own.
export function buildRawTodoData(grouped: GroupedTodos): RawTodoData {
  return {
    projects: grouped.projects,
    categoryGroups: grouped.categoryGroups,
    incidentals: grouped.incidentals,
    recurringProjects: grouped.recurringProjects,
    recurringCategoryGroups: grouped.recurringCategoryGroups,
    recurringIncidentals: grouped.recurringIncidentals,
  };
}
