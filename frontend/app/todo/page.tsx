"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import TodoForm from "./components/TodoForm";
import ProjectForm from "./components/ProjectForm";
import LayoutRenderer from "./components/LayoutRenderer";
import RecentStats from "./components/RecentStats";
import type { Project, Todo, TodoCategory } from "@/app/types/admin";
import {
  getTodayInEST,
  parseInEST,
  getISOTimestampInEST,
  toISODateInEST,
} from "@/app/lib/dateUtils";
import {
  transformLayout,
  type RawTodoData,
  type TodoGroup,
} from "@/app/lib/layoutTransformers";
import { getPresetById, getDefaultPreset } from "@/app/types/layoutRuleset";
import { useLayoutRuleset } from "@/app/contexts/LayoutRulesetContext";
import { useTodoActions } from "@/app/contexts/TodoActionsContext";
import { useTimezoneContext } from "@/app/contexts/TimezoneContext";
import FaviconManager from "@/app/components/FaviconManager";
import { createTodosFromShows } from "@/app/lib/showsTodoCreator";

export default function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<TodoGroup[]>([]);
  const [incidentals, setIncidentals] = useState<Todo[]>([]);
  const [recurringProjects, setRecurringProjects] = useState<Project[]>([]);
  const [recurringCategoryGroups, setRecurringCategoryGroups] = useState<
    TodoGroup[]
  >([]);
  const [recurringIncidentals, setRecurringIncidentals] = useState<Todo[]>([]);
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
  const [loading, setLoading] = useState(true);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerContainer, setDrawerContainer] = useState<HTMLElement | null>(
    null
  );
  // Track mapping of completed recurring todos to their newly created next instances
  const [recurringTodoMap, setRecurringTodoMap] = useState<Map<string, string>>(
    new Map()
  );
  // Track mapping of skipped recurring todos: original ID -> { newTodoId, originalTodo }
  const [skippedTodoMap, setSkippedTodoMap] = useState<Map<string, { newTodoId: string; originalTodo: Todo }>>(
    new Map()
  );
  const { selectedRulesetId } = useLayoutRuleset();
  const { drawerContent, openTodoForm, openProjectForm, closeDrawer } =
    useTodoActions();
  const { timezone } = useTimezoneContext();

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    if (selectedRulesetId === "done") {
      fetchCompletedTodos();
      fetchUpcomingTodos();
      fetchLongTodosWithSessions();
      fetchRecentStats();
      fetchRecentStats30Days();
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

  // Check for new band shows and create todos
  useEffect(() => {
    const checkAndCreateShowTodos = async () => {
      try {
        const result = await createTodosFromShows();

        if (result.success && result.todosCreated > 0) {
          console.log(
            `Created ${result.todosCreated} todos from ${result.showsProcessed} shows`
          );
          // Refresh the todo list to show the new todos
          fetchTodos(false);
        } else if (!result.success && result.error) {
          console.error("Failed to create todos from shows:", result.error);
        }
      } catch (error) {
        console.error("Error checking for show todos:", error);
      }
    };

    checkAndCreateShowTodos();
  }, []);

  const fetchTodos = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await fetch("/api/todos");
      const result = await response.json();

      if (result.success) {
        const allTodos: Todo[] = result.data;

        // Filter out long todos that have been worked on today
        const today = getTodayInEST();
        const todayDateString = toISODateInEST(today);
        const visibleTodos = allTodos.filter((todo: Todo) => {
          // If it's a long todo and has been worked on today, hide it
          if (
            todo.long &&
            todo.workSessions &&
            todo.workSessions.find((ws) => ws.date === todayDateString)
          ) {
            return false;
          }
          return true;
        });

        // Separate recurring and non-recurring todos
        // Only show recurring todos whose display date has arrived

        const recurringTodos = visibleTodos.filter((todo: Todo) => {
          if (!todo.isRecurring) return false;
          if (!todo.displayDate) return true; // Show if no date set (legacy)
          const startDate = parseInEST(todo.displayDate);
          return startDate <= today;
        });
        const nonRecurringTodos = visibleTodos.filter(
          (todo: Todo) => !todo.isRecurring
        );

        // Process non-recurring todos
        const projectMap = new Map<string, Project>();
        const todosWithoutProjects: Todo[] = [];

        nonRecurringTodos.forEach((todo: Todo) => {
          if (todo.project) {
            const project = todo.project as any;
            if (!projectMap.has(project.documentId)) {
              projectMap.set(project.documentId, {
                ...project,
                todos: [],
              });
            }
            projectMap.get(project.documentId)!.todos!.push(todo);
          } else {
            todosWithoutProjects.push(todo);
          }
        });

        const categoryMap = new Map<TodoCategory, Todo[]>();
        const incidentalTodos: Todo[] = [];

        todosWithoutProjects.forEach((todo: Todo) => {
          if (todo.category) {
            if (!categoryMap.has(todo.category)) {
              categoryMap.set(todo.category, []);
            }
            categoryMap.get(todo.category)!.push(todo);
          } else {
            incidentalTodos.push(todo);
          }
        });

        // Process recurring todos
        const recurringProjectMap = new Map<string, Project>();
        const recurringTodosWithoutProjects: Todo[] = [];

        recurringTodos.forEach((todo: Todo) => {
          if (todo.project) {
            const project = todo.project as any;
            if (!recurringProjectMap.has(project.documentId)) {
              recurringProjectMap.set(project.documentId, {
                ...project,
                todos: [],
              });
            }
            recurringProjectMap.get(project.documentId)!.todos!.push(todo);
          } else {
            recurringTodosWithoutProjects.push(todo);
          }
        });

        const recurringCategoryMap = new Map<TodoCategory, Todo[]>();
        const recurringIncidentalTodos: Todo[] = [];

        recurringTodosWithoutProjects.forEach((todo: Todo) => {
          if (todo.category) {
            if (!recurringCategoryMap.has(todo.category)) {
              recurringCategoryMap.set(todo.category, []);
            }
            recurringCategoryMap.get(todo.category)!.push(todo);
          } else {
            recurringIncidentalTodos.push(todo);
          }
        });

        // Convert maps to arrays
        const projectsArray = Array.from(projectMap.values());
        const groups: TodoGroup[] = Array.from(categoryMap.entries()).map(
          ([category, todos]) => ({
            title: category,
            todos,
          })
        );

        const recurringProjectsArray = Array.from(recurringProjectMap.values());
        const recurringGroups: TodoGroup[] = Array.from(
          recurringCategoryMap.entries()
        ).map(([category, todos]) => ({
          title: category,
          todos,
        }));

        setProjects(projectsArray);
        setCategoryGroups(groups);
        setIncidentals(incidentalTodos);
        setRecurringProjects(recurringProjectsArray);
        setRecurringCategoryGroups(recurringGroups);
        setRecurringIncidentals(recurringIncidentalTodos);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to fetch todos");
      console.error("Error fetching todos:", err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchCompletedTodos = async () => {
    try {
      const response = await fetch("/api/todos/completed");
      const result = await response.json();

      if (result.success) {
        const allCompletedTodos: Todo[] = result.data;
        setCompletedTodos(allCompletedTodos);
      } else {
        setError(result.error);
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
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error("Error fetching upcoming todos:", err);
      setUpcomingTodos([]);
    }
  };

  const fetchLongTodosWithSessions = async () => {
    try {
      const response = await fetch("/api/todos/long-with-sessions");
      const result = await response.json();

      if (result.success) {
        setLongTodosWithSessions(result.data);
      } else {
        setError(result.error);
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
      // Find the todo to check its current completed state
      let currentTodo: Todo | undefined;

      // Search through all state arrays to find the todo
      for (const project of [...projects, ...recurringProjects]) {
        currentTodo = project.todos?.find((t) => t.documentId === documentId);
        if (currentTodo) break;
      }

      if (!currentTodo) {
        for (const group of [...categoryGroups, ...recurringCategoryGroups]) {
          currentTodo = group.todos.find((t) => t.documentId === documentId);
          if (currentTodo) break;
        }
      }

      if (!currentTodo) {
        currentTodo = [...incidentals, ...recurringIncidentals].find(
          (t) => t.documentId === documentId
        );
      }

      // Also check completedTodos (for "done" layout)
      if (!currentTodo) {
        currentTodo = completedTodos.find((t) => t.documentId === documentId);
      }

      if (!currentTodo) {
        console.error("Todo not found");
        return;
      }

      const isCurrentlyCompleted = currentTodo.completed;
      let response;
      let result;

      if (isCurrentlyCompleted) {
        // Un-complete the todo
        response = await fetch(`/api/todos/${documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completed: false,
            completedAt: null,
          }),
        });

        if (response.ok) {
          result = await response.json();

          // If this was a recurring todo that created a next instance, delete it
          if (currentTodo.isRecurring && recurringTodoMap.has(documentId)) {
            const newTodoId = recurringTodoMap.get(documentId)!;

            // Delete the next instance from the database
            await fetch(`/api/todos/${newTodoId}`, {
              method: "DELETE",
            });

            // Remove from the map
            setRecurringTodoMap((prev) => {
              const newMap = new Map(prev);
              newMap.delete(documentId);
              return newMap;
            });

            // Remove from state arrays
            setRecurringProjects((prev) =>
              prev
                .map((project) => ({
                  ...project,
                  todos:
                    project.todos?.filter((t) => t.documentId !== newTodoId) ||
                    [],
                }))
                .filter((project) => (project.todos?.length || 0) > 0)
            );

            setRecurringCategoryGroups((prev) =>
              prev
                .map((group) => ({
                  ...group,
                  todos: group.todos.filter((t) => t.documentId !== newTodoId),
                }))
                .filter((group) => group.todos.length > 0)
            );

            setRecurringIncidentals((prev) =>
              prev.filter((t) => t.documentId !== newTodoId)
            );
          }
        }
      } else {
        // Complete the todo
        response = await fetch(`/api/todos/${documentId}/complete`, {
          method: "POST",
        });

        if (response.ok) {
          result = await response.json();
        }
      }

      if (response.ok) {
        // Optimistically update local state instead of re-fetching everything
        // Toggle the completed state
        const newCompletedState = !isCurrentlyCompleted;

        setProjects((prev) =>
          prev.map((project) => ({
            ...project,
            todos:
              project.todos?.map((t) =>
                t.documentId === documentId
                  ? { ...t, completed: newCompletedState }
                  : t
              ) || [],
          }))
        );

        setCategoryGroups((prev) =>
          prev.map((group) => ({
            ...group,
            todos: group.todos.map((t) =>
              t.documentId === documentId
                ? { ...t, completed: newCompletedState }
                : t
            ),
          }))
        );

        setIncidentals((prev) =>
          prev.map((t) =>
            t.documentId === documentId
              ? { ...t, completed: newCompletedState }
              : t
          )
        );

        setRecurringProjects((prev) =>
          prev.map((project) => ({
            ...project,
            todos:
              project.todos?.map((t) =>
                t.documentId === documentId
                  ? { ...t, completed: newCompletedState }
                  : t
              ) || [],
          }))
        );

        setRecurringCategoryGroups((prev) =>
          prev.map((group) => ({
            ...group,
            todos: group.todos.map((t) =>
              t.documentId === documentId
                ? { ...t, completed: newCompletedState }
                : t
            ),
          }))
        );

        setRecurringIncidentals((prev) =>
          prev.map((t) =>
            t.documentId === documentId
              ? { ...t, completed: newCompletedState }
              : t
          )
        );

        // Handle completedTodos state
        if (isCurrentlyCompleted) {
          // Uncompleting: remove from completedTodos
          setCompletedTodos((prev) =>
            prev.filter((t) => t.documentId !== documentId)
          );

          // Only add back to regular state if we're in the "done" view
          // (meaning the todo was ONLY in completedTodos, not in regular arrays)
          const todoWasOnlyInCompletedTodos = selectedRulesetId === "done";

          if (todoWasOnlyInCompletedTodos) {
            // Use the updated todo from API response, or fall back to currentTodo
            const uncompletedTodo = result.data || {
              ...currentTodo,
              completed: false,
              completedAt: null,
            };

            if (uncompletedTodo.isRecurring) {
              // Handle recurring todo
              if (uncompletedTodo.project) {
                const project = uncompletedTodo.project as any;
                setRecurringProjects((prev) => {
                  const existingProject = prev.find(
                    (p) => p.documentId === project.documentId
                  );
                  if (existingProject) {
                    return prev.map((p) =>
                      p.documentId === project.documentId
                        ? { ...p, todos: [...(p.todos || []), uncompletedTodo] }
                        : p
                    );
                  } else {
                    return [...prev, { ...project, todos: [uncompletedTodo] }];
                  }
                });
              } else if (uncompletedTodo.category) {
                setRecurringCategoryGroups((prev) => {
                  const existingGroup = prev.find(
                    (g) => g.title === uncompletedTodo.category
                  );
                  if (existingGroup) {
                    return prev.map((g) =>
                      g.title === uncompletedTodo.category
                        ? { ...g, todos: [...g.todos, uncompletedTodo] }
                        : g
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        title: uncompletedTodo.category,
                        todos: [uncompletedTodo],
                      },
                    ];
                  }
                });
              } else {
                setRecurringIncidentals((prev) => [...prev, uncompletedTodo]);
              }
            } else {
              // Handle non-recurring todo
              if (uncompletedTodo.project) {
                const project = uncompletedTodo.project as any;
                setProjects((prev) => {
                  const existingProject = prev.find(
                    (p) => p.documentId === project.documentId
                  );
                  if (existingProject) {
                    return prev.map((p) =>
                      p.documentId === project.documentId
                        ? { ...p, todos: [...(p.todos || []), uncompletedTodo] }
                        : p
                    );
                  } else {
                    return [...prev, { ...project, todos: [uncompletedTodo] }];
                  }
                });
              } else if (uncompletedTodo.category) {
                setCategoryGroups((prev) => {
                  const existingGroup = prev.find(
                    (g) => g.title === uncompletedTodo.category
                  );
                  if (existingGroup) {
                    return prev.map((g) =>
                      g.title === uncompletedTodo.category
                        ? { ...g, todos: [...g.todos, uncompletedTodo] }
                        : g
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        title: uncompletedTodo.category,
                        todos: [uncompletedTodo],
                      },
                    ];
                  }
                });
              } else {
                setIncidentals((prev) => [...prev, uncompletedTodo]);
              }
            }
          }
        } else if (selectedRulesetId === "done") {
          // Completing and in "done" layout: add to completedTodos
          // The complete endpoint doesn't return the completed todo, so use currentTodo with updated fields
          const completedTodo = {
            ...currentTodo,
            completed: true,
            completedAt: getISOTimestampInEST(),
          };
          setCompletedTodos((prev) => [completedTodo, ...prev]);
        }

        // If a new recurring todo was created, track it and add to list if appropriate
        if (result.newTodo) {
          const newTodo = result.newTodo;

          // Track the relationship between the completed todo and its new instance
          setRecurringTodoMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(documentId, newTodo.documentId);
            return newMap;
          });

          // Check if the new todo should be shown yet (same logic as initial fetch)
          const shouldShow =
            !newTodo.displayDate ||
            parseInEST(newTodo.displayDate) <= getTodayInEST();

          if (shouldShow) {
            if (newTodo.project) {
              const project = newTodo.project as any;
              setRecurringProjects((prev) => {
                const existingProject = prev.find(
                  (p) => p.documentId === project.documentId
                );
                if (existingProject) {
                  return prev.map((p) =>
                    p.documentId === project.documentId
                      ? { ...p, todos: [...(p.todos || []), newTodo] }
                      : p
                  );
                } else {
                  return [...prev, { ...project, todos: [newTodo] }];
                }
              });
            } else if (newTodo.category) {
              setRecurringCategoryGroups((prev) => {
                const existingGroup = prev.find(
                  (g) => g.title === newTodo.category
                );
                if (existingGroup) {
                  return prev.map((g) =>
                    g.title === newTodo.category
                      ? { ...g, todos: [...g.todos, newTodo] }
                      : g
                  );
                } else {
                  return [
                    ...prev,
                    { title: newTodo.category, todos: [newTodo] },
                  ];
                }
              });
            } else {
              setRecurringIncidentals((prev) => [...prev, newTodo]);
            }
          }
        }
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
      // Check if this is a "worked on" virtual entry
      // Pattern: originalDocumentId-worked-YYYY-MM-DD
      const workedOnMatch = documentId.match(
        /^(.+)-worked-(\d{4}-\d{2}-\d{2})$/
      );
      const actualDocumentId = workedOnMatch ? workedOnMatch[1] : documentId;

      const response = await fetch(`/api/todos/${actualDocumentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Optimistically update local state instead of re-fetching everything
        // Remove from all state arrays
        setProjects((prev) =>
          prev
            .map((project) => ({
              ...project,
              todos:
                project.todos?.filter(
                  (t) => t.documentId !== actualDocumentId
                ) || [],
            }))
            .filter((project) => (project.todos?.length || 0) > 0)
        );

        setCategoryGroups((prev) =>
          prev
            .map((group) => ({
              ...group,
              todos: group.todos.filter(
                (t) => t.documentId !== actualDocumentId
              ),
            }))
            .filter((group) => group.todos.length > 0)
        );

        setIncidentals((prev) =>
          prev.filter((t) => t.documentId !== actualDocumentId)
        );

        setRecurringProjects((prev) =>
          prev
            .map((project) => ({
              ...project,
              todos:
                project.todos?.filter(
                  (t) => t.documentId !== actualDocumentId
                ) || [],
            }))
            .filter((project) => (project.todos?.length || 0) > 0)
        );

        setRecurringCategoryGroups((prev) =>
          prev
            .map((group) => ({
              ...group,
              todos: group.todos.filter(
                (t) => t.documentId !== actualDocumentId
              ),
            }))
            .filter((group) => group.todos.length > 0)
        );

        setRecurringIncidentals((prev) =>
          prev.filter((t) => t.documentId !== actualDocumentId)
        );

        // If in "done" view, also update the completed, upcoming, and long todos state
        if (selectedRulesetId === "done") {
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
        // Remove the todo from all state arrays (it's now hidden for the day)
        setProjects((prev) =>
          prev
            .map((project) => ({
              ...project,
              todos:
                project.todos?.filter((t) => t.documentId !== documentId) || [],
            }))
            .filter((project) => (project.todos?.length || 0) > 0)
        );

        setCategoryGroups((prev) =>
          prev
            .map((group) => ({
              ...group,
              todos: group.todos.filter((t) => t.documentId !== documentId),
            }))
            .filter((group) => group.todos.length > 0)
        );

        setIncidentals((prev) =>
          prev.filter((t) => t.documentId !== documentId)
        );

        setRecurringProjects((prev) =>
          prev
            .map((project) => ({
              ...project,
              todos:
                project.todos?.filter((t) => t.documentId !== documentId) || [],
            }))
            .filter((project) => (project.todos?.length || 0) > 0)
        );

        setRecurringCategoryGroups((prev) =>
          prev
            .map((group) => ({
              ...group,
              todos: group.todos.filter((t) => t.documentId !== documentId),
            }))
            .filter((group) => group.todos.length > 0)
        );

        setRecurringIncidentals((prev) =>
          prev.filter((t) => t.documentId !== documentId)
        );
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
        if (selectedRulesetId === "done") {
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
      const isAlreadySkipped = skippedTodoMap.has(documentId);

      if (isAlreadySkipped) {
        // Unskip: delete the new recurrence and recreate the original
        const skippedData = skippedTodoMap.get(documentId)!;
        const newTodoId = skippedData.newTodoId;
        const originalTodo = skippedData.originalTodo;

        // Delete the new instance from the database
        await fetch(`/api/todos/${newTodoId}`, {
          method: "DELETE",
        });

        // Recreate the original todo in the database (use same format as skip route)
        const recreateResponse = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: originalTodo.title,
            description: originalTodo.description,
            dueDate: originalTodo.dueDate,
            displayDate: originalTodo.displayDate,
            displayDateOffset: originalTodo.displayDateOffset,
            completed: false,
            completedAt: null,
            isRecurring: originalTodo.isRecurring,
            recurrenceType: originalTodo.recurrenceType,
            recurrenceInterval: originalTodo.recurrenceInterval,
            recurrenceDayOfWeek: originalTodo.recurrenceDayOfWeek,
            recurrenceDayOfMonth: originalTodo.recurrenceDayOfMonth,
            recurrenceWeekOfMonth: originalTodo.recurrenceWeekOfMonth,
            recurrenceDayOfWeekMonthly: originalTodo.recurrenceDayOfWeekMonthly,
            recurrenceMonth: originalTodo.recurrenceMonth,
            category: originalTodo.category,
            project: originalTodo.project ? (originalTodo.project as any).documentId : null,
            soon: originalTodo.soon,
            long: originalTodo.long,
            trackingUrl: originalTodo.trackingUrl,
            purchaseUrl: originalTodo.purchaseUrl,
            price: originalTodo.price,
            wishListCategory: originalTodo.wishListCategory,
          }),
        });

        if (recreateResponse.ok) {
          const result = await recreateResponse.json();
          const recreatedTodo = result.data;

          // Remove from the skip map
          setSkippedTodoMap((prev) => {
            const newMap = new Map(prev);
            newMap.delete(documentId);
            return newMap;
          });
          
          // Remove the old todo (with old documentId) and add the recreated one (with new documentId)
          if (recreatedTodo.project) {
            if (recreatedTodo.isRecurring) {
              setRecurringProjects((prev) =>
                prev.map((project) => {
                  if (project.documentId === (recreatedTodo.project as any).documentId) {
                    return {
                      ...project,
                      todos: [
                        ...(project.todos?.filter((t) => t.documentId !== documentId) || []),
                        recreatedTodo,
                      ],
                    };
                  }
                  return project;
                })
              );
            } else {
              setProjects((prev) =>
                prev.map((project) => {
                  if (project.documentId === (recreatedTodo.project as any).documentId) {
                    return {
                      ...project,
                      todos: [
                        ...(project.todos?.filter((t) => t.documentId !== documentId) || []),
                        recreatedTodo,
                      ],
                    };
                  }
                  return project;
                })
              );
            }
          } else if (recreatedTodo.category) {
            if (recreatedTodo.isRecurring) {
              setRecurringCategoryGroups((prev) =>
                prev.map((group) => {
                  if (group.title === recreatedTodo.category) {
                    return {
                      ...group,
                      todos: [
                        ...group.todos.filter((t) => t.documentId !== documentId),
                        recreatedTodo,
                      ],
                    };
                  }
                  return group;
                })
              );
            } else {
              setCategoryGroups((prev) =>
                prev.map((group) => {
                  if (group.title === recreatedTodo.category) {
                    return {
                      ...group,
                      todos: [
                        ...group.todos.filter((t) => t.documentId !== documentId),
                        recreatedTodo,
                      ],
                    };
                  }
                  return group;
                })
              );
            }
          } else {
            // Incidental
            if (recreatedTodo.isRecurring) {
              setRecurringIncidentals((prev) => [
                ...prev.filter((t) => t.documentId !== documentId),
                recreatedTodo,
              ]);
            } else {
              setIncidentals((prev) => [
                ...prev.filter((t) => t.documentId !== documentId),
                recreatedTodo,
              ]);
            }
          }
        }
      } else {
        // Skip: delete original from DB, create next recurrence, keep original visible in state
        // Find the todo
        let currentTodo: Todo | undefined;

        for (const project of [...projects, ...recurringProjects]) {
          currentTodo = project.todos?.find((t) => t.documentId === documentId);
          if (currentTodo) break;
        }

        if (!currentTodo) {
          for (const group of [...categoryGroups, ...recurringCategoryGroups]) {
            currentTodo = group.todos.find((t) => t.documentId === documentId);
            if (currentTodo) break;
          }
        }

        if (!currentTodo) {
          currentTodo = [...incidentals, ...recurringIncidentals].find(
            (t) => t.documentId === documentId
          );
        }

        if (!currentTodo) {
          console.error("Todo not found");
          return;
        }

        const response = await fetch(`/api/todos/${documentId}/skip`, {
          method: "POST",
        });

        if (response.ok) {
          const result = await response.json();

          // Track the skip in our map with the original todo data
          // The original todo stays in state with its documentId, and will appear with .completed class
          if (result.newTodo && result.deletedTodo) {
            setSkippedTodoMap((prev) => {
              const newMap = new Map(prev);
              newMap.set(documentId, {
                newTodoId: result.newTodo.documentId,
                originalTodo: result.deletedTodo,
              });
              return newMap;
            });

            // DO NOT add the new recurrence to visible state
            // It will appear on next page load when its displayDate arrives
          }
        }
      }
    } catch (err) {
      console.error("Error skipping/unskipping recurring todo:", err);
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const url = editingTodo
        ? `/api/todos/${editingTodo.documentId}`
        : "/api/todos";

      const method = editingTodo ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedTodo = result.data;

        // Check if the todo being edited is in completedTodos (from "done" layout)
        const isInCompletedTodos =
          editingTodo &&
          completedTodos.some((t) => t.documentId === editingTodo.documentId);

        // Check if the todo being edited is in longTodosWithSessions (from "done" layout)
        const isInLongTodos =
          editingTodo &&
          longTodosWithSessions.some(
            (t) => t.documentId === editingTodo.documentId
          );

        if (isInCompletedTodos && updatedTodo) {
          // Update completedTodos state directly
          setCompletedTodos((prev) =>
            prev.map((t) =>
              t.documentId === editingTodo.documentId ? updatedTodo : t
            )
          );
        }

        if (isInLongTodos && updatedTodo) {
          // Update longTodosWithSessions state directly
          setLongTodosWithSessions((prev) =>
            prev.map((t) =>
              t.documentId === editingTodo.documentId ? updatedTodo : t
            )
          );
        }

        if (!isInCompletedTodos && !isInLongTodos) {
          // For todos not in done view, refresh the regular todos
          await fetchTodos();
        }

        closeDrawer();
        setEditingTodo(null);
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

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        closeDrawer();
        setEditingProject(null);
        await fetchTodos();
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
    const rawData: RawTodoData = {
      projects,
      categoryGroups,
      incidentals,
      recurringProjects,
      recurringCategoryGroups,
      recurringIncidentals,
      completedTodos: selectedRulesetId === "done" ? completedTodos : undefined,
      upcomingTodos: selectedRulesetId === "done" ? upcomingTodos : undefined,
      longTodosWithSessions:
        selectedRulesetId === "done" ? longTodosWithSessions : undefined,
    };
    return transformLayout(rawData, ruleset);
  }, [
    selectedRulesetId,
    projects,
    categoryGroups,
    incidentals,
    recurringProjects,
    recurringCategoryGroups,
    recurringIncidentals,
    completedTodos,
    upcomingTodos,
    longTodosWithSessions,
  ]);

  const ruleset = getPresetById(selectedRulesetId) || getDefaultPreset();
  const layoutClass = `layout-${selectedRulesetId}`;

  if (loading) {
    return (
      <div id="admin-home" className={layoutClass} suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="admin-home" className={layoutClass} suppressHydrationWarning>
        <p>error: {error}</p>
      </div>
    );
  }

  const hasAnyTodos =
    projects.length > 0 || categoryGroups.length > 0 || incidentals.length > 0;
  const hasRecurringTodos =
    recurringProjects.length > 0 ||
    recurringCategoryGroups.length > 0 ||
    recurringIncidentals.length > 0;

  return (
    <>
      <FaviconManager type="broom" />
      <div id="admin-home" className={layoutClass} suppressHydrationWarning>
        {!hasAnyTodos && !hasRecurringTodos ? (
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
            skippedTodoMap={skippedTodoMap}
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
