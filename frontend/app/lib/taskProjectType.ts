import type { Task, ProjectType } from "@/app/types/index";
import { STUFF_PROJECT_TYPES } from "@/app/types/index";

// A task's "kind" now comes from its project's `projectType`, not the retired
// `category` field. Stuff project types (wishlist / errands / in the mail /
// buy stuff) keep the same string values the old categories used, so callers
// that compared `task.category === "wishlist"` become
// `getTaskProjectType(task) === "wishlist"`.
export function getTaskProjectType(task: Task): ProjectType | null {
  return task.project?.projectType ?? null;
}

// True when the task belongs to one of the four "stuff" project types (the
// shopping/errands/wishlist feature that lives in the `stuff` world).
export function isStuffTask(task: Task): boolean {
  const projectType = getTaskProjectType(task);
  return projectType !== null && STUFF_PROJECT_TYPES.includes(projectType);
}
