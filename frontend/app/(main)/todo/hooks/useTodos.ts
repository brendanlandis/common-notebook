"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Project, Todo } from "@/app/types/index";
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
import { groupTodosForLayout, type GroupedTodos } from "@/app/lib/groupTodos";
import { createTodosFromShows } from "@/app/lib/showsTodoCreator";

export interface UseTodosResult {
  todos: Todo[];
  grouped: GroupedTodos;
  loading: boolean;
  error: string | null;
  addTodo: (t: Todo) => void;
  removeTodo: (id: string) => void;
  updateTodo: (t: Todo) => void;
  updateProject: (p: Project) => void;
  addManualProject: (p: Project) => void;
  refetch: (showLoading?: boolean) => Promise<void>;
}

// Owns the active-todos data domain: the flat `todos` array, the empty-project
// overlay (`manualProjects`), and all the derived groupings via useMemo.
// Mutations go through addTodo/removeTodo/updateTodo so the UI rerenders
// consistently without per-handler array bookkeeping.
export function useTodos(): UseTodosResult {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [manualProjects, setManualProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addTodo = useCallback(
    (t: Todo) => setTodos((prev) => [...prev, t]),
    []
  );
  const removeTodo = useCallback(
    (id: string) =>
      setTodos((prev) => prev.filter((t) => t.documentId !== id)),
    []
  );
  const updateTodo = useCallback(
    (t: Todo) =>
      setTodos((prev) =>
        prev.map((x) => (x.documentId === t.documentId ? t : x))
      ),
    []
  );

  const addManualProject = useCallback(
    (p: Project) => setManualProjects((prev) => [...prev, p]),
    []
  );

  // Project metadata lives on each todo's `project` relation. When metadata
  // changes, propagate to every todo that references it. Also update any
  // matching entry in manualProjects so renames show before todos are added.
  const updateProject = useCallback((updated: Project) => {
    setTodos((prev) =>
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
      const response = await fetch("/api/todos");
      const result = await response.json();

      if (result.success) {
        const allTodos: Todo[] = result.data;

        // Filter out long todos worked on in the current "phase 2" window and
        // completed todos older than the visibility window.
        const now = getNowInEST();
        const visibilityMinutes = getCompletedTaskVisibilityMinutes();
        const dayBoundaryHour = getDayBoundaryHour();

        const visibleTodos = allTodos.filter((todo: Todo) => {
          if (todo.long && todo.workSessions && todo.workSessions.length > 0) {
            const mostRecentSession = todo.workSessions
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

          if (todo.completed && todo.completedAt) {
            const completedTime = new Date(todo.completedAt);
            const minutesSinceCompletion =
              (now.getTime() - completedTime.getTime()) / (1000 * 60);
            if (minutesSinceCompletion > visibilityMinutes) return false;
          }

          return true;
        });

        // Phase enrichment for CSS class application downstream.
        const todosWithPhaseInfo = visibleTodos.map((todo: Todo) => {
          if (todo.long && todo.workSessions && todo.workSessions.length > 0) {
            const mostRecentSession = todo.workSessions
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
              return { ...todo, workedOnPhase: phase };
            }
          }
          return todo;
        });

        setTodos(todosWithPhaseInfo);
        setManualProjects([]);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to fetch todos");
      console.error("Error fetching todos:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Derive all groupings from `todos`. Empty user-created projects are spliced
  // in from `manualProjects` so they show until the next refetch clears them.
  const grouped = useMemo<GroupedTodos>(() => {
    const today = getTodayInEST();
    const base = groupTodosForLayout(todos, today);
    if (manualProjects.length > 0) {
      const existingIds = new Set(base.projects.map((p) => p.documentId));
      const extras = manualProjects
        .filter((p) => !existingIds.has(p.documentId))
        .map((p) => ({ ...p, todos: [] }));
      if (extras.length > 0) {
        return { ...base, projects: [...base.projects, ...extras] };
      }
    }
    return base;
  }, [todos, manualProjects]);

  // Initial load: prime the visibility cache before fetching todos.
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

  // Auto-create todos from new band shows.
  useEffect(() => {
    const checkAndCreate = async () => {
      try {
        const result = await createTodosFromShows();
        if (result.success && result.todosCreated > 0) {
          console.log(
            `Created ${result.todosCreated} todos from ${result.showsProcessed} shows`
          );
          refetch(false);
        } else if (!result.success && result.error) {
          console.error("Failed to create todos from shows:", result.error);
        }
      } catch (err) {
        console.error("Error checking for show todos:", err);
      }
    };
    checkAndCreate();
  }, [refetch]);

  return {
    todos,
    grouped,
    loading,
    error,
    addTodo,
    removeTodo,
    updateTodo,
    updateProject,
    addManualProject,
    refetch,
  };
}
