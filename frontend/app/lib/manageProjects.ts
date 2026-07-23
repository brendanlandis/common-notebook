import type { Project, Task, World } from "@/app/types/index";
import { orderProjectColumns } from "./layoutTransformers";

// Pure logic for the Manage Projects drawer, split out so the section rules are
// unit-testable without rendering.

/**
 * Section 1 ("Are these done yet?"): non-complete projects with no incomplete
 * task in the active list.
 *
 * `tasks` is the flat active list (incomplete + recently-completed), which
 * includes recurring tasks — so a project with live recurring work is correctly
 * excluded. Empty projects (no tasks at all) qualify: a zero-task project counts
 * as "nothing to do", per the decision to include empties.
 */
export function doneCandidates(projects: Project[], tasks: Task[]): Project[] {
  const hasIncomplete = new Set<string>();
  for (const t of tasks) {
    const id = (t.project as Project | null | undefined)?.documentId;
    if (id && !t.completed) hasIncomplete.add(id);
  }
  return projects.filter((p) => !p.complete && !hasIncomplete.has(p.documentId));
}

/**
 * Order section-1 candidates by their most recent task completion, newest first.
 * `completedTasks` is the recently-completed list (`/api/tasks/completed`), whose
 * tasks carry `completedAt` + a shallow `project`. A candidate with no completion
 * in that window (an empty project, or one finished longer ago than the window)
 * has no date and sorts to the bottom, keeping its incoming order.
 */
export function orderDoneCandidates(candidates: Project[], completedTasks: Task[]): Project[] {
  const last = new Map<string, string>();
  for (const t of completedTasks) {
    const id = (t.project as Project | null | undefined)?.documentId;
    const at = t.completedAt;
    if (!id || !at) continue;
    const prev = last.get(id);
    if (!prev || at > prev) last.set(id, at);
  }
  return [...candidates].sort((a, b) => {
    const la = last.get(a.documentId);
    const lb = last.get(b.documentId);
    if (la && lb) return la > lb ? -1 : la < lb ? 1 : 0; // most recent first
    if (la) return -1; // dated ones ahead of undated
    if (lb) return 1;
    return 0; // neither dated: stable
  });
}

export interface WorldGroup {
  world: World | null;
  key: string; // world documentId, or NO_WORLD_KEY
  label: string; // world title, or "no world"
  projects: Project[]; // ordered as the task views order columns
}

export const NO_WORLD_KEY = "__none__";

/**
 * Section 3 ("Manage all projects"): non-complete projects grouped by world in
 * the given world order (no-world bucket last), each world's projects ordered
 * exactly as the task views order columns (`orderProjectColumns`). Worlds with no
 * projects are omitted.
 */
export function groupProjectsByWorld(projects: Project[], worlds: World[]): WorldGroup[] {
  const incomplete = projects.filter((p) => !p.complete);
  const byWorld = new Map<string, Project[]>();
  for (const p of incomplete) {
    const key = p.world?.documentId ?? NO_WORLD_KEY;
    if (!byWorld.has(key)) byWorld.set(key, []);
    byWorld.get(key)!.push(p);
  }

  const groups: WorldGroup[] = [];
  for (const w of worlds) {
    const list = byWorld.get(w.documentId);
    if (list && list.length) {
      groups.push({ world: w, key: w.documentId, label: w.title, projects: orderProjectColumns(list) });
    }
  }
  const none = byWorld.get(NO_WORLD_KEY);
  if (none && none.length) {
    groups.push({ world: null, key: NO_WORLD_KEY, label: "no world", projects: orderProjectColumns(none) });
  }
  return groups;
}
