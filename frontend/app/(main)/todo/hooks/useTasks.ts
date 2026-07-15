"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Project, Task, World } from "@/app/types/index";
import {
  getTodayInEST,
  getNowInEST,
} from "@/app/lib/dateUtils";
import {
  getCompletedTaskVisibilityMinutes,
  fetchVisibilityMinutesFromStrapi,
} from "@/app/lib/completedTaskVisibilityConfig";
import { getWorkedOnPhase } from "@/app/lib/dayBoundaryHelpers";
import { getDayBoundaryHour } from "@/app/lib/timezoneConfig";
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
  addManualProject: (p: Project) => void;
  refetch: (showLoading?: boolean) => Promise<void>;
  /** The world of a project by documentId, from the normalized projects map. */
  worldForProjectId: (documentId?: string | null) => World | null;
}

// Owns the active-tasks data domain: the flat `tasks` array, the empty-project
// overlay (`manualProjects`), and all the derived groupings via useMemo.
// Mutations go through addTask/removeTask/updateTask so the UI rerenders
// consistently without per-handler array bookkeeping.
export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [manualProjects, setManualProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A task's world lives on its project, but /api/tasks only shallow-populates
  // the project (no worldRef). We fetch the normalized projects (which carry the
  // World object) into this map and stitch it onto every task's project so the
  // layout engine can group by world. Rename-stable: refetched, not derived from
  // a stale enum.
  const projectsByIdRef = useRef<Map<string, Project>>(new Map());

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

  const addManualProject = useCallback((p: Project) => {
    projectsByIdRef.current.set(p.documentId, p);
    setManualProjects((prev) => [...prev, p]);
  }, []);

  // Project metadata lives on each task's `project` relation. When metadata
  // changes, propagate to every task that references it. Also update any
  // matching entry in manualProjects so renames show before tasks are added.
  const updateProject = useCallback((updated: Project) => {
    projectsByIdRef.current.set(updated.documentId, updated);
    setTasks((prev) =>
      prev.map((t) => {
        const proj = t.project as any;
        if (proj && proj.documentId === updated.documentId) {
          return { ...t, project: { ...proj, ...updated } as any };
        }
        return t;
      })
    );
    setManualProjects((prev) =>
      prev.map((p) =>
        p.documentId === updated.documentId ? updated : p
      )
    );
  }, []);

  const refetch = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [tasksResponse, projectsResponse] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/projects"),
      ]);
      const result = await tasksResponse.json();
      const projectsResult = await projectsResponse.json();

      // Build the project→world map before enriching tasks below.
      if (projectsResult.success) {
        projectsByIdRef.current = new Map(
          (projectsResult.data as Project[]).map((p) => [p.documentId, p])
        );
      }

      if (result.success) {
        const allTasks: Task[] = result.data;

        // Filter out long tasks worked on in the current "phase 2" window and
        // completed tasks older than the visibility window.
        const now = getNowInEST();
        const visibilityMinutes = getCompletedTaskVisibilityMinutes();
        const dayBoundaryHour = getDayBoundaryHour();

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
                dayBoundaryHour
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
                dayBoundaryHour
              );
              return { ...task, workedOnPhase: phase };
            }
          }
          return task;
        });

        setTasks(tasksWithPhaseInfo.map(enrichTaskWorld));
        setManualProjects([]);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to fetch tasks");
      console.error("Error fetching tasks:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [enrichTaskWorld]);

  // Derive all groupings from `tasks`. Empty user-created projects are spliced
  // in from `manualProjects` so they show until the next refetch clears them.
  const grouped = useMemo<GroupedTasks>(() => {
    const today = getTodayInEST();
    const base = groupTasksForLayout(tasks, today);
    if (manualProjects.length > 0) {
      const existingIds = new Set(base.projects.map((p) => p.documentId));
      const extras = manualProjects
        .filter((p) => !existingIds.has(p.documentId))
        .map((p) => ({ ...p, tasks: [] }));
      if (extras.length > 0) {
        return { ...base, projects: [...base.projects, ...extras] };
      }
    }
    return base;
  }, [tasks, manualProjects]);

  // Initial load: prime the visibility cache before fetching tasks.
  useEffect(() => {
    const init = async () => {
      await fetchVisibilityMinutesFromStrapi();
      refetch();
    };
    init();
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
        const result = await createTasksFromShows();
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
    addManualProject,
    refetch,
    worldForProjectId,
  };
}
