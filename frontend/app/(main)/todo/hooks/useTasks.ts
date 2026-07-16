"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, Task, World } from "@/app/types/index";
import { getToday } from "@/app/lib/dateUtils";
import { getWorkedOnPhase } from "@/app/lib/dayBoundaryHelpers";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { groupTasksForLayout, type GroupedTasks } from "@/app/lib/groupTasks";
import { createTasksFromShows } from "@/app/lib/showsTaskCreator";
import { apiFetch } from "@/app/lib/apiFetch";
import { PROJECTS_QUERY_KEY, useProjects, type ProjectsResponse } from "@/app/hooks/useProjects";

export interface UseTasksResult {
  tasks: Task[];
  grouped: GroupedTasks;
  loading: boolean;
  error: string | null;
  addTask: (t: Task) => void;
  removeTask: (id: string) => void;
  updateTask: (t: Task) => void;
  updateProject: (p: Project) => void;
  addProject: (p: Project) => void;
  refetch: (showLoading?: boolean) => Promise<void>;
  /** The world of a project by documentId, from the normalized projects map. */
  worldForProjectId: (documentId?: string | null) => World | null;
}

// Keys nest under one `['tasks']` root so a single invalidate covers every list
// (see usePracticeLogs for the same shape). `['projects']` is a sibling root.
export const TASKS_ROOT = ["tasks"] as const;
export const TASKS_ACTIVE_KEY = [...TASKS_ROOT, "active"] as const;

interface TasksResponse {
  success?: boolean;
  data?: Task[];
}

// Owns the active-tasks data domain. The cache holds the raw server payload; the
// world join, the visibility filter and the groupings are all derived from it, so
// nothing has to be kept in sync by hand.
export function useTasks(): UseTasksResult {
  const { timeZoneSettings, completedTaskVisibilityMinutes } = useDateTimeSettings();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: TASKS_ACTIVE_KEY,
    queryFn: () => apiFetch<TasksResponse>("/api/tasks"),
  });

  const { projects, projectsById, loading: projectsLoading, error: projectsError } = useProjects();

  // A task's world lives on its project, but /api/tasks only shallow-populates the
  // project (no worldRef), so it's stitched on from the projects list. This used to
  // be a ref written inside the same Promise.all that fetched the tasks — the one
  // thing that guaranteed the map was built before any task was enriched. As two
  // queries plus a derivation the ordering is correct by construction: whatever the
  // two arrive in, the join only ever runs over what's currently in the cache.
  const enrichTaskWorld = useCallback(
    (task: Task): Task => {
      const proj = task.project as Project | null | undefined;
      if (!proj?.documentId) return task;
      const full = projectsById.get(proj.documentId);
      return { ...task, project: { ...proj, world: full?.world ?? null } };
    },
    [projectsById]
  );

  const worldForProjectId = useCallback(
    (documentId?: string | null): World | null =>
      documentId ? projectsById.get(documentId)?.world ?? null : null,
    [projectsById]
  );

  const rawTasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data]);

  // Filter out long tasks worked on in the current "phase 2" window and completed
  // tasks older than the visibility window, then attach the phase for CSS.
  //
  // `now` is when this data was last known to be true, not when we happen to be
  // rendering. That is what the pre-query code did — it filtered the payload once,
  // at fetch time, and froze the result in state, so a task the user completed
  // locally was never re-filtered. Reading the render clock instead looks equivalent
  // but is not: an optimistic completion is instantly "stale" to a 0-minute window,
  // so the row vanished the moment the checkbox was ticked rather than fading.
  // dataUpdatedAt also advances on a focus refetch, which is what fixes the older
  // bug of a tab left open for an hour still showing tasks completed 50 minutes ago.
  //
  // A real instant, NOT getNow(): getNow returns toZonedTime(new Date(), tz), whose
  // getTime() is shifted by the zone's offset rather than being the current moment.
  // Both readings below compare it against real UTC instants (`completedAt`, a work
  // session's `timestamp`), and getWorkedOnPhase zones `now` itself via
  // getEffectiveDayForTimestamp — so a pre-zoned value was both wrong arithmetic and
  // a double conversion. It only looked right where the OS zone equals the user's
  // configured zone (offset 0); under UTC the clock read five hours early and kept
  // tasks it should have dropped. Wall-clock formatting still uses getNow.
  //
  // Deliberately not in `select`: TanStack memoizes that on data identity.
  const tasks = useMemo(() => {
    // Pure: dataUpdatedAt is a value the cache hands us, not a clock read during
    // render. When it is 0 there is no data yet, so `now` never gets used.
    const now = new Date(tasksQuery.dataUpdatedAt);
    const visibilityMinutes = completedTaskVisibilityMinutes;

    const mostRecentSession = (task: Task) =>
      task.workSessions
        ?.slice()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    const phaseOf = (task: Task): 1 | 2 | 3 | undefined => {
      if (!task.long || !task.workSessions?.length) return undefined;
      const session = mostRecentSession(task);
      if (!session) return undefined;
      return getWorkedOnPhase(session.timestamp, now, visibilityMinutes, timeZoneSettings);
    };

    return rawTasks
      .filter((task) => {
        if (phaseOf(task) === 2) return false;

        if (task.completed && task.completedAt) {
          const minutesSinceCompletion =
            (now.getTime() - new Date(task.completedAt).getTime()) / (1000 * 60);
          if (minutesSinceCompletion > visibilityMinutes) return false;
        }

        return true;
      })
      .map((task) => {
        const phase = phaseOf(task);
        const withPhase = phase === undefined ? task : { ...task, workedOnPhase: phase };
        return enrichTaskWorld(withPhase);
      });
  }, [
    rawTasks,
    tasksQuery.dataUpdatedAt,
    enrichTaskWorld,
    timeZoneSettings,
    completedTaskVisibilityMinutes,
  ]);

  // Derive all groupings from `tasks` + `projects`. Projects with no tasks come
  // through with an empty `tasks` array rather than being spliced in afterwards.
  const grouped = useMemo<GroupedTasks>(
    () => groupTasksForLayout(tasks, projects, getToday(timeZoneSettings), timeZoneSettings),
    [tasks, projects, timeZoneSettings]
  );

  // The list mutators write straight to the cache, so a caller's optimistic edit
  // and a refetch land in the same place. They take the raw payload shape
  // ({success, data}), not the derived list above.
  //
  // Each pins `updatedAt` to the value already on the query. Left alone,
  // setQueryData stamps the cache with the current time, which would drag the
  // filter's `now` (see above) forward to the moment of the local write — and a
  // task completed at that instant is immediately older than a 0-minute visibility
  // window, so the row vanished on click instead of fading. It only survived when
  // Strapi's completedAt happened to land a few milliseconds ahead of the browser's
  // clock, which made it a coin flip. `now` must mean "when the server last told us
  // this", so only a real fetch may advance it.
  const withPinnedTimestamp = useCallback(
    <T,>(key: readonly unknown[], update: (old: T | undefined) => T | undefined) => {
      const updatedAt = queryClient.getQueryState<T>(key)?.dataUpdatedAt;
      queryClient.setQueryData<T>(key, update, updatedAt ? { updatedAt } : undefined);
    },
    [queryClient]
  );

  const setTasksData = useCallback(
    (update: (previous: Task[]) => Task[]) => {
      withPinnedTimestamp<TasksResponse>(TASKS_ACTIVE_KEY, (old) =>
        old?.data ? { ...old, data: update(old.data) } : old
      );
    },
    [withPinnedTimestamp]
  );

  const addTask = useCallback(
    (t: Task) => setTasksData((prev) => [...prev, t]),
    [setTasksData]
  );

  const removeTask = useCallback(
    (id: string) => setTasksData((prev) => prev.filter((t) => t.documentId !== id)),
    [setTasksData]
  );

  const updateTask = useCallback(
    (t: Task) => setTasksData((prev) => prev.map((x) => (x.documentId === t.documentId ? t : x))),
    [setTasksData]
  );

  const setProjectsData = useCallback(
    (update: (previous: Project[]) => Project[]) => {
      withPinnedTimestamp<ProjectsResponse>(PROJECTS_QUERY_KEY, (old) =>
        old?.data ? { ...old, data: update(old.data) } : old
      );
    },
    [withPinnedTimestamp]
  );

  const addProject = useCallback(
    (p: Project) =>
      setProjectsData((prev) =>
        prev.some((x) => x.documentId === p.documentId) ? prev : [...prev, p]
      ),
    [setProjectsData]
  );

  // Project metadata lives both in `projects` and on each task's `project`
  // relation, so a rename has to land in both.
  const updateProject = useCallback(
    (updated: Project) => {
      setProjectsData((prev) =>
        prev.map((p) => (p.documentId === updated.documentId ? updated : p))
      );
      setTasksData((prev) =>
        prev.map((t) => {
          const proj = t.project as Project | null | undefined;
          return proj && proj.documentId === updated.documentId
            ? { ...t, project: { ...proj, ...updated } }
            : t;
        })
      );
    },
    [setProjectsData, setTasksData]
  );

  // Callers still pass `showLoading`, so the signature keeps it, but the parameter
  // is not declared: the cache serves the previous data while refetching, so there
  // is no blank-then-repaint to suppress. The argument is accepted and ignored.
  const refetch = useCallback<(showLoading?: boolean) => Promise<void>>(
    async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TASKS_ACTIVE_KEY }),
        queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
      ]);
    },
    [queryClient]
  );

  // Moon-phase reset event listener (fired by /api/system-settings updates).
  // Retiring this bus for a plain invalidate is Stage 6.
  useEffect(() => {
    const handler = () => {
      void refetch(false);
    };
    window.addEventListener("moon-phase-reset", handler);
    return () => window.removeEventListener("moon-phase-reset", handler);
  }, [refetch]);

  // Auto-create tasks from new band shows.
  useEffect(() => {
    const checkAndCreate = async () => {
      try {
        const result = await createTasksFromShows(timeZoneSettings);
        if (result.success && result.tasksCreated > 0) {
          console.log(
            `Created ${result.tasksCreated} tasks from ${result.showsProcessed} shows`
          );
          void refetch(false);
        } else if (!result.success && result.error) {
          console.error("Failed to create tasks from shows:", result.error);
        }
      } catch (err) {
        console.error("Error checking for show tasks:", err);
      }
    };
    void checkAndCreate();
  }, [refetch, timeZoneSettings]);

  const failure = tasksQuery.error ?? projectsError ?? null;

  return {
    tasks,
    grouped,
    loading: tasksQuery.isPending || projectsLoading,
    error: failure ? failure.message : null,
    addTask,
    removeTask,
    updateTask,
    updateProject,
    addProject,
    refetch,
    worldForProjectId,
  };
}
