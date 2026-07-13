"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Project, Task } from "@/app/types/index";
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

  const addTask = useCallback(
    (t: Task) => setTasks((prev) => [...prev, t]),
    []
  );
  const removeTask = useCallback(
    (id: string) =>
      setTasks((prev) => prev.filter((t) => t.documentId !== id)),
    []
  );
  const updateTask = useCallback(
    (t: Task) =>
      setTasks((prev) =>
        prev.map((x) => (x.documentId === t.documentId ? t : x))
      ),
    []
  );

  const addManualProject = useCallback(
    (p: Project) => setManualProjects((prev) => [...prev, p]),
    []
  );

  // Project metadata lives on each task's `project` relation. When metadata
  // changes, propagate to every task that references it. Also update any
  // matching entry in manualProjects so renames show before tasks are added.
  const updateProject = useCallback((updated: Project) => {
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
      const response = await fetch("/api/tasks");
      const result = await response.json();

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

        setTasks(tasksWithPhaseInfo);
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
  }, []);

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
  };
}
