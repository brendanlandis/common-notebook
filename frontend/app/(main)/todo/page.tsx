"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import TodoForm from "./components/TodoForm";
import ProjectForm from "./components/ProjectForm";
import LayoutRenderer from "./components/LayoutRenderer";
import RecentStats from "./components/RecentStats";
import type { Project, Todo } from "@/app/types/index";
import { getISOTimestampInEST } from "@/app/lib/dateUtils";
import {
  transformLayout,
  type RawTodoData,
} from "@/app/lib/layoutTransformers";
import { getPresetById, getDefaultPreset } from "@/app/lib/layoutPresets";
import { useLayoutRuleset } from "@/app/contexts/LayoutRulesetContext";
import { useTodoActions } from "@/app/contexts/TodoActionsContext";
import { useTimezoneContext } from "@/app/contexts/TimezoneContext";
import FaviconManager from "@/app/components/FaviconManager";
import { useTodos } from "./hooks/useTodos";

export default function TodoPage() {
  const {
    todos,
    grouped,
    loading,
    error,
    addTodo,
    removeTodo,
    updateTodo,
    updateProject,
    addManualProject,
    refetch: fetchTodos,
  } = useTodos();
  const [completedTodos, setCompletedTodos] = useState<Todo[]>([]);
  const [upcomingTodos, setUpcomingTodos] = useState<Todo[]>([]);
  const [longTodosWithSessions, setLongTodosWithSessions] = useState<Todo[]>(
    []
  );
  const [recentStats, setRecentStats] = useState<
    Array<{ type: "project" | "category"; name: string; count: number }>
  >([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [recentStats30Days, setRecentStats30Days] = useState<
    Array<{ type: "project" | "category"; name: string; count: number }>
  >([]);
  const [statsLoading30Days, setStatsLoading30Days] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [drawerContainer, setDrawerContainer] = useState<HTMLElement | null>(
    null
  );
  const { selectedRulesetId } = useLayoutRuleset();
  const { drawerContent, openTodoForm, openProjectForm, closeDrawer } =
    useTodoActions();
  const { timezone } = useTimezoneContext();

  useEffect(() => {
    if (selectedRulesetId === "done") {
      fetchCompletedTodos();
      fetchUpcomingTodos();
      fetchLongTodosWithSessions();
      fetchRecentStats();
      fetchRecentStats30Days();
    } else if (selectedRulesetId === "invoicing") {
      fetchCompletedTodos(60);
      fetchLongTodosWithSessions(60);
    }
  }, [selectedRulesetId]);

  useEffect(() => {
    // Find the drawer container after mount
    setDrawerContainer(document.getElementById("drawer-form-container"));
  }, []);

  // Reset editing state when drawer closes
  useEffect(() => {
    if (drawerContent === null) {
      setEditingTodo(null);
      setEditingProject(null);
    }
  }, [drawerContent]);

  const fetchCompletedTodos = async (days: number = 30) => {
    try {
      const response = await fetch(`/api/todos/completed?days=${days}`);
      const result = await response.json();

      if (result.success) {
        const allCompletedTodos: Todo[] = result.data;
        setCompletedTodos(allCompletedTodos);
      }
    } catch (err) {
      console.error("Error fetching completed todos:", err);
      setCompletedTodos([]);
    }
  };

  const fetchUpcomingTodos = async () => {
    try {
      const response = await fetch("/api/todos/upcoming");
      const result = await response.json();

      if (result.success) {
        const allUpcomingTodos: Todo[] = result.data;
        setUpcomingTodos(allUpcomingTodos);
      }
    } catch (err) {
      console.error("Error fetching upcoming todos:", err);
      setUpcomingTodos([]);
    }
  };

  const fetchLongTodosWithSessions = async (days: number = 30) => {
    try {
      const response = await fetch(`/api/todos/long-with-sessions?days=${days}`);
      const result = await response.json();

      if (result.success) {
        setLongTodosWithSessions(result.data);
      }
    } catch (err) {
      console.error("Error fetching long todos with sessions:", err);
      setLongTodosWithSessions([]);
    }
  };

  const fetchRecentStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch("/api/todos/stats?days=7");
      const result = await response.json();

      if (result.success) {
        setRecentStats(result.data);
      } else {
        console.error("Error fetching recent stats:", result.error);
        setRecentStats([]);
      }
    } catch (err) {
      console.error("Error fetching recent stats:", err);
      setRecentStats([]);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchRecentStats30Days = async () => {
    try {
      setStatsLoading30Days(true);
      const response = await fetch("/api/todos/stats?days=30");
      const result = await response.json();

      if (result.success) {
        setRecentStats30Days(result.data);
      } else {
        console.error("Error fetching 30-day stats:", result.error);
        setRecentStats30Days([]);
      }
    } catch (err) {
      console.error("Error fetching 30-day stats:", err);
      setRecentStats30Days([]);
    } finally {
      setStatsLoading30Days(false);
    }
  };

  const handleComplete = async (documentId: string) => {
    try {
      // Look up the todo in the active list first; fall back to completedTodos
      // (which is populated only in "done"/"invoicing" views).
      const currentTodo =
        todos.find((t) => t.documentId === documentId) ||
        completedTodos.find((t) => t.documentId === documentId);

      if (!currentTodo) {
        console.error("Todo not found");
        return;
      }

      const isCurrentlyCompleted = currentTodo.completed;
      let response;
      let result: any;

      if (isCurrentlyCompleted) {
        response = await fetch(`/api/todos/${documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: false, completedAt: null }),
        });
        if (response.ok) result = await response.json();
      } else {
        response = await fetch(`/api/todos/${documentId}/complete`, {
          method: "POST",
        });
        if (response.ok) result = await response.json();
      }

      if (!response.ok) return;

      const newCompletedState = !isCurrentlyCompleted;
      const todoIsInActiveList = todos.some((t) => t.documentId === documentId);

      if (todoIsInActiveList) {
        // Toggle completed/completedAt on the single source of truth.
        const currentInActive = todos.find((t) => t.documentId === documentId);
        if (currentInActive) {
          updateTodo({
            ...currentInActive,
            completed: newCompletedState,
            completedAt: newCompletedState ? getISOTimestampInEST() : null,
          });
        }
      }

      // Maintain the separate `completedTodos` list used only by the "done"
      // and "invoicing" views.
      if (isCurrentlyCompleted) {
        // Uncompleting: drop from completedTodos.
        setCompletedTodos((prev) =>
          prev.filter((t) => t.documentId !== documentId)
        );
        // If the todo was visible only in completedTodos (not in active
        // todos), splice it back into the active list so it appears once the
        // user switches views.
        if (!todoIsInActiveList) {
          const uncompletedTodo: Todo = result?.data || {
            ...currentTodo,
            completed: false,
            completedAt: null,
          };
          addTodo(uncompletedTodo);
        }
      } else if (
        selectedRulesetId === "done" ||
        selectedRulesetId === "invoicing"
      ) {
        // Completing while viewing "done"/"invoicing": add to completedTodos
        // so it appears in the completed list immediately.
        const completedTodo: Todo = {
          ...currentTodo,
          completed: true,
          completedAt: getISOTimestampInEST(),
        };
        setCompletedTodos((prev) => [completedTodo, ...prev]);
      }

      // If completing a recurring todo created the next occurrence, add it.
      if (result?.newTodo) {
        addTodo(result.newTodo);
      }
    } catch (err) {
      console.error("Error completing todo:", err);
      // On error, re-fetch to ensure UI is in sync
      await fetchTodos();
    }
  };

  const handleEdit = (todo: Todo) => {
    // Check if this is a "worked on" virtual entry
    // Pattern: originalDocumentId-worked-YYYY-MM-DD
    const workedOnMatch = todo.documentId.match(
      /^(.+)-worked-(\d{4}-\d{2}-\d{2})$/
    );

    if (workedOnMatch) {
      // This is a "worked on" entry, find the original todo
      const originalDocumentId = workedOnMatch[1];
      const originalTodo = longTodosWithSessions.find(
        (t) => t.documentId === originalDocumentId
      );

      if (originalTodo) {
        setEditingTodo(originalTodo);
      } else {
        console.error(
          "Could not find original todo for worked on entry:",
          originalDocumentId
        );
        setEditingTodo(todo);
      }
    } else {
      setEditingTodo(todo);
    }

    openTodoForm();
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    openProjectForm();
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this todo?")) return;

    try {
      // Pattern: originalDocumentId-worked-YYYY-MM-DD (a "worked on" virtual entry)
      const workedOnMatch = documentId.match(
        /^(.+)-worked-(\d{4}-\d{2}-\d{2})$/
      );
      const actualDocumentId = workedOnMatch ? workedOnMatch[1] : documentId;

      const response = await fetch(`/api/todos/${actualDocumentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        removeTodo(actualDocumentId);

        if (selectedRulesetId === "done" || selectedRulesetId === "invoicing") {
          setCompletedTodos((prev) =>
            prev.filter((t) => t.documentId !== actualDocumentId)
          );
          setUpcomingTodos((prev) =>
            prev.filter((t) => t.documentId !== actualDocumentId)
          );
          setLongTodosWithSessions((prev) =>
            prev.filter((t) => t.documentId !== actualDocumentId)
          );
        }
      }
    } catch (err) {
      console.error("Error deleting todo:", err);
    }
  };

  const handleWorkSession = async (documentId: string) => {
    try {
      const response = await fetch(`/api/todos/${documentId}/work-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timezone }),
      });

      if (response.ok) {
        // Refresh todos to apply phase-based visibility logic
        await fetchTodos(false);
      }
    } catch (err) {
      console.error("Error adding work session:", err);
    }
  };

  const handleRemoveWorkSession = async (
    originalDocumentId: string,
    date: string
  ) => {
    try {
      const response = await fetch(
        `/api/todos/${originalDocumentId}/work-session/${date}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Optimistically remove the "worked on" entry from longTodosWithSessions
        if (selectedRulesetId === "done" || selectedRulesetId === "invoicing") {
          setLongTodosWithSessions(
            (prev) =>
              prev
                .map((todo) => {
                  if (
                    todo.documentId === originalDocumentId &&
                    todo.workSessions
                  ) {
                    return {
                      ...todo,
                      workSessions: todo.workSessions.filter(
                        (ws) => ws.date !== date
                      ),
                    };
                  }
                  return todo;
                })
                .filter(
                  (todo) => !todo.workSessions || todo.workSessions.length > 0
                ) // Remove todos with no sessions left
          );
        }

        // Refresh the main todos in the background (without showing loading state)
        await fetchTodos(false);
      }
    } catch (err) {
      console.error("Error removing work session:", err);
    }
  };

  const handleSkipRecurring = async (documentId: string) => {
    try {
      const response = await fetch(`/api/todos/${documentId}/skip`, {
        method: "POST",
      });

      if (response.ok) {
        // The skipped occurrence is gone; the new occurrence will appear on
        // the next fetchTodos when its displayDate arrives.
        removeTodo(documentId);
      }
    } catch (err) {
      console.error("Error skipping recurring todo:", err);
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const url = editingTodo
        ? `/api/todos/${editingTodo.documentId}`
        : "/api/todos";

      const method = editingTodo ? "PUT" : "POST";

      // Store editingTodo reference before clearing
      const wasEditingTodo = editingTodo;

      // Close drawer and reset form immediately (optimistic update)
      closeDrawer();
      setEditingTodo(null);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedTodo: Todo = result.data;

        // The todo may live in the "done" view's separate state arrays. Update
        // those directly so the user sees their edit reflected there too.
        const isInCompletedTodos =
          wasEditingTodo &&
          completedTodos.some(
            (t) => t.documentId === wasEditingTodo.documentId
          );
        const isInLongTodos =
          wasEditingTodo &&
          longTodosWithSessions.some(
            (t) => t.documentId === wasEditingTodo.documentId
          );

        if (isInCompletedTodos && updatedTodo) {
          setCompletedTodos((prev) =>
            prev.map((t) =>
              t.documentId === wasEditingTodo.documentId ? updatedTodo : t
            )
          );
        }

        if (isInLongTodos && updatedTodo) {
          setLongTodosWithSessions((prev) =>
            prev.map((t) =>
              t.documentId === wasEditingTodo.documentId ? updatedTodo : t
            )
          );
        }

        if (!isInCompletedTodos && !isInLongTodos) {
          if (wasEditingTodo) {
            updateTodo(updatedTodo);
          } else {
            addTodo(updatedTodo);
          }
        }
      }
    } catch (err) {
      console.error("Error saving todo:", err);
    }
  };

  const handleCancelForm = () => {
    closeDrawer();
    setEditingTodo(null);
  };

  const handleProjectFormSubmit = async (data: any) => {
    try {
      const url = editingProject
        ? `/api/projects/${editingProject.documentId}`
        : "/api/projects";

      const method = editingProject ? "PUT" : "POST";

      // Store editingProject reference before clearing
      const wasEditingProject = editingProject;

      // Close drawer and reset form immediately (optimistic update)
      closeDrawer();
      setEditingProject(null);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedProject: Project = result.data;

        if (wasEditingProject) {
          // Propagate metadata to every todo that references this project; the
          // grouping useMemo will recompute layout placement automatically.
          updateProject(updatedProject);
        } else {
          // New project created with no todos yet. Show it in the layout
          // until the next fetchTodos clears the manualProjects overlay.
          if (
            updatedProject.world === "life stuff" ||
            updatedProject.world === "music admin" ||
            updatedProject.world === "make music" ||
            updatedProject.world === "computer"
          ) {
            addManualProject(updatedProject);
          }
        }
      }
    } catch (err) {
      console.error("Error saving project:", err);
    }
  };

  const handleCancelProjectForm = () => {
    closeDrawer();
    setEditingProject(null);
  };

  // Transform layout using selected ruleset
  const transformedData = useMemo(() => {
    const ruleset = getPresetById(selectedRulesetId) || getDefaultPreset();
    const useUnfilteredRecurring = selectedRulesetId === "recurring";
    const rawData: RawTodoData = {
      projects: grouped.projects,
      categoryGroups: grouped.categoryGroups,
      incidentals: grouped.incidentals,
      recurringProjects: useUnfilteredRecurring
        ? grouped.allRecurringProjects
        : grouped.recurringProjects,
      recurringCategoryGroups: useUnfilteredRecurring
        ? grouped.allRecurringCategoryGroups
        : grouped.recurringCategoryGroups,
      recurringIncidentals: useUnfilteredRecurring
        ? grouped.allRecurringIncidentals
        : grouped.recurringIncidentals,
      completedTodos:
        selectedRulesetId === "done" || selectedRulesetId === "invoicing"
          ? completedTodos
          : undefined,
      upcomingTodos:
        selectedRulesetId === "done" ? upcomingTodos : undefined,
      longTodosWithSessions:
        selectedRulesetId === "done" || selectedRulesetId === "invoicing"
          ? longTodosWithSessions
          : undefined,
    };
    return transformLayout(rawData, ruleset);
  }, [
    selectedRulesetId,
    grouped,
    completedTodos,
    upcomingTodos,
    longTodosWithSessions,
  ]);

  const ruleset = getPresetById(selectedRulesetId) || getDefaultPreset();
  const layoutClass = `layout-${selectedRulesetId}`;

  if (loading) {
    return (
      <div id="container-todo" className={layoutClass} suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="container-todo" className={layoutClass} suppressHydrationWarning>
        <p>error: {error}</p>
      </div>
    );
  }

  const hasAnyTodos =
    grouped.projects.length > 0 ||
    grouped.categoryGroups.length > 0 ||
    grouped.incidentals.length > 0;
  const hasRecurringTodos =
    grouped.recurringProjects.length > 0 ||
    grouped.recurringCategoryGroups.length > 0 ||
    grouped.recurringIncidentals.length > 0;
  const hasCompletedTodos = completedTodos.length > 0;

  return (
    <>
      <FaviconManager type="broom" />
      <div id="container-todo" className={layoutClass} suppressHydrationWarning>
        {!hasAnyTodos && !hasRecurringTodos && !hasCompletedTodos ? (
          <p>nothin' to do, nowhere to be</p>
        ) : (
          <LayoutRenderer
            transformedData={transformedData}
            ruleset={ruleset}
            selectedRulesetId={selectedRulesetId}
            onComplete={handleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onWorkSession={handleWorkSession}
            onRemoveWorkSession={handleRemoveWorkSession}
            onSkipRecurring={handleSkipRecurring}
            onEditProject={handleEditProject}
            recentStatsSection={
              selectedRulesetId === "done" &&
              (recentStats.length > 0 || recentStats30Days.length > 0) ? (
                <div className="todo-section recent-stats-section">
                  <h3>recently</h3>
                  <div>
                    <RecentStats
                      stats={recentStats}
                      loading={statsLoading}
                      title="last 7 days"
                      noWrapper
                    />
                    <RecentStats
                      stats={recentStats30Days}
                      loading={statsLoading30Days}
                      title="last 30 days"
                      noWrapper
                    />
                  </div>
                </div>
              ) : undefined
            }
          />
        )}

        {drawerContainer &&
          drawerContent === "todo" &&
          createPortal(
            <TodoForm
              key={editingTodo?.documentId || "new"}
              todo={editingTodo || undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleCancelForm}
            />,
            drawerContainer
          )}

        {drawerContainer &&
          drawerContent === "project" &&
          createPortal(
            <ProjectForm
              key={editingProject?.documentId || "new"}
              project={editingProject || undefined}
              onSubmit={handleProjectFormSubmit}
              onCancel={handleCancelProjectForm}
            />,
            drawerContainer
          )}
      </div>
    </>
  );
}
