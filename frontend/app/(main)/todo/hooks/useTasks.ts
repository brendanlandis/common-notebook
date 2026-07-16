"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Project, Task, World } from "@/app/types/index";
import {
  getToday,
  getNow,
} from "@/app/lib/dateUtils";
import { getWorkedOnPhase } from "@/app/lib/dayBoundaryHelpers";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { groupTasksForLayout, type GroupedTasks } from "@/app/lib/groupTasks";
import { createTasksFromShows } from "@/app/lib/showsTaskCreator";

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

// Owns the active-tasks data domain: the flat `tasks` array, the user's
// `projects`, and all the derived groupings via useMemo.
// Mutations go through addTask/removeTask/updateTask so the UI rerenders
// consistently without per-handler array bookkeeping.
export function useTasks(): UseTasksResult {
  const { timeZoneSettings, completedTaskVisibilityMinutes } = useDateTimeSettings();
  const [tasks, setTasks] = useState<Task[]>([]);
  // The full project list, not just the ones tasks reference — an empty project
  // has to survive a refetch, which the old `manualProjects` overlay could not do
  // (it was cleared on every refetch, so a new project vanished).
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A task's world lives on its project, but /api/tasks only shallow-populates
  // the project (no worldRef). We fetch the normalized projects (which carry the
  // World object) into this map and stitch it onto every task's project so the
  // layout engine can group by world. Rename-stable: refetched, not derived from
  // a stale enum.
  const projectsByIdRef = useRef<Map<string, Project>>(new Map());

  // Monotonic stamp so a slow refetch can't overwrite a newer one's result.
  const latestRequestRef = useRef(0);

  const enrichTaskWorld = useCallback((task: Task): Task => {
    const proj = task.project as Project | null | undefined;
    if (!proj?.documentId) return task;
    const full = projectsByIdRef.current.get(proj.documentId);
    return { ...task, project: { ...proj, world: full?.world ?? null } };
  }, []);

  const worldForProjectId = useCallback(
    (documentId?: string | null): World | null =>
      documentId ? projectsByIdRef.current.get(documentId)?.world ?? null : null,
    []
  );

  const addTask = useCallback(
    (t: Task) => setTasks((prev) => [...prev, enrichTaskWorld(t)]),
    [enrichTaskWorld]
  );
  const removeTask = useCallback(
    (id: string) =>
      setTasks((prev) => prev.filter((t) => t.documentId !== id)),
    []
  );
  const updateTask = useCallback(
    (t: Task) =>
      setTasks((prev) =>
        prev.map((x) => (x.documentId === t.documentId ? enrichTaskWorld(t) : x))
      ),
    [enrichTaskWorld]
  );

  // Show a newly created project at once. Unlike the overlay this replaced, the
  // next refetch keeps it: /api/projects returns it too.
  const addProject = useCallback((p: Project) => {
    projectsByIdRef.current.set(p.documentId, p);
    setProjects((prev) =>
      prev.some((x) => x.documentId === p.documentId) ? prev : [...prev, p]
    );
  }, []);

  // Project metadata lives both in `projects` and on each task's `project`
  // relation, so a rename has to land in both.
  const updateProject = useCallback((updated: Project) => {
    projectsByIdRef.current.set(updated.documentId, updated);
    setProjects((prev) =>
      prev.map((p) => (p.documentId === updated.documentId ? updated : p))
    );
    setTasks((prev) =>
      prev.map((t) => {
        const proj = t.project as any;
        if (proj && proj.documentId === updated.documentId) {
          return { ...t, project: { ...proj, ...updated } as any };
        }
        return t;
      })
    );
  }, []);

  const refetch = useCallback(async (showLoading = true) => {
    // Mount fires two refetches (the initial load and, if shows created tasks,
    // createTasksFromShows) with nothing sequencing them. Stamp each attempt and
    // let only the newest one write, so a slow earlier response can't land on top
    // of a newer one.
    const requestId = ++latestRequestRef.current;
    const isStale = () => requestId !== latestRequestRef.current;

    try {
      if (showLoading) setLoading(true);
      const [tasksResponse, projectsResponse] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/projects"),
      ]);
      const result = await tasksResponse.json();
      const projectsResult = await projectsResponse.json();

      if (isStale()) return;

      // Build the project→world map before enriching tasks below. The ref is
      // what `enrichTaskWorld` reads synchronously here and in addTask/updateTask;
      // the state is what the grouping renders from.
      if (projectsResult.success) {
        const projectList = projectsResult.data as Project[];
        projectsByIdRef.current = new Map(projectList.map((p) => [p.documentId, p]));
        setProjects(projectList);
      }

      if (result.success) {
        const allTasks: Task[] = result.data;

        // Filter out long tasks worked on in the current "phase 2" window and
        // completed tasks older than the visibility window.
        const now = getNow(timeZoneSettings);
        const visibilityMinutes = completedTaskVisibilityMinutes;

        const visibleTasks = allTasks.filter((task: Task) => {
          if (task.long && task.workSessions && task.workSessions.length > 0) {
            const mostRecentSession = task.workSessions
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              )[0];

            if (mostRecentSession) {
              const phase = getWorkedOnPhase(
                mostRecentSession.timestamp,
                now,
                visibilityMinutes,
                timeZoneSettings
              );
              if (phase === 2) return false;
            }
          }

          if (task.completed && task.completedAt) {
            const completedTime = new Date(task.completedAt);
            const minutesSinceCompletion =
              (now.getTime() - completedTime.getTime()) / (1000 * 60);
            if (minutesSinceCompletion > visibilityMinutes) return false;
          }

          return true;
        });

        // Phase enrichment for CSS class application downstream.
        const tasksWithPhaseInfo = visibleTasks.map((task: Task) => {
          if (task.long && task.workSessions && task.workSessions.length > 0) {
            const mostRecentSession = task.workSessions
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              )[0];

            if (mostRecentSession) {
              const phase = getWorkedOnPhase(
                mostRecentSession.timestamp,
                now,
                visibilityMinutes,
                timeZoneSettings
              );
              return { ...task, workedOnPhase: phase };
            }
          }
          return task;
        });

        setTasks(tasksWithPhaseInfo.map(enrichTaskWorld));
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
      if (!isStale()) setError("Failed to fetch tasks");
    } finally {
      if (showLoading && !isStale()) setLoading(false);
    }
  }, [enrichTaskWorld, timeZoneSettings, completedTaskVisibilityMinutes]);

  // Derive all groupings from `tasks` + `projects`. Projects with no tasks come
  // through with an empty `tasks` array rather than being spliced in afterwards.
  const grouped = useMemo<GroupedTasks>(
    () => groupTasksForLayout(tasks, projects, getToday(timeZoneSettings), timeZoneSettings),
    [tasks, projects, timeZoneSettings]
  );

  // Initial load. This used to await a fetch that primed a module cache before
  // refetching, purely because the filter below read that cache synchronously.
  // The visibility window now arrives with the provider, so the hop is gone.
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Moon-phase reset event listener (fired by /api/system-settings updates).
  useEffect(() => {
    const handler = () => refetch(false);
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
          refetch(false);
        } else if (!result.success && result.error) {
          console.error("Failed to create tasks from shows:", result.error);
        }
      } catch (err) {
        console.error("Error checking for show tasks:", err);
      }
    };
    checkAndCreate();
  }, [refetch]);

  return {
    tasks,
    grouped,
    loading,
    error,
    addTask,
    removeTask,
    updateTask,
    updateProject,
    addProject,
    refetch,
    worldForProjectId,
  };
}
