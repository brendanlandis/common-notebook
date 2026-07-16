"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { Project, Task } from "@/app/types/index";
import type { GroupedTasks } from "@/app/lib/groupTasks";
import { usePathname } from "next/navigation";
import { getISOTimestampInEST } from "@/app/lib/dateUtils";
import { getDefaultViewSlug } from "@/app/lib/views";
import { useViews } from "@/app/contexts/ViewsContext";
import { useTaskActions } from "@/app/contexts/TaskActionsContext";
import { useTimezoneContext } from "@/app/contexts/TimezoneContext";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useTasks } from "../hooks/useTasks";

// Stats shape used by the "done" view's RecentStats panels.
export type RecentStatItem = {
  type: "project" | "category";
  name: string;
  count: number;
};

interface TaskDataContextType {
  // Active-task data (shared by every /todo route)
  tasks: Task[];
  grouped: GroupedTasks;
  loading: boolean;
  error: string | null;

  // Secondary data, only populated for the "done"/"invoicing" index views.
  completedTasks: Task[];
  upcomingTasks: Task[];
  longTasksWithSessions: Task[];
  recentStats: RecentStatItem[];
  statsLoading: boolean;
  recentStats30Days: RecentStatItem[];
  statsLoading30Days: boolean;

  // Add/edit form state (drives the shared drawer forms).
  editingTask: Task | null;
  editingProject: Project | null;

  // Core mutation handlers — passed to LayoutRenderer on any route.
  onComplete: (documentId: string) => void;
  onEdit: (task: Task) => void;
  onEditProject: (project: Project) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;

  // Form submit/cancel — used by the shared TaskForms portals.
  onSubmitTask: (data: any) => void;
  onCancelTaskForm: () => void;
  onSubmitProject: (data: any) => void;
  onCancelProjectForm: () => void;
}

const TaskDataContext = createContext<TaskDataContextType | undefined>(
  undefined
);

// Owns the task data domain and all mutation handlers for the whole /todo
// route group. Mounted once in task/layout.tsx so the index page and the
// per-world / per-project pages share one live dataset and one set of
// mutations. The engine (transformLayout/LayoutRenderer) stays pure; each
// page builds its own ruleset and calls it.
export function TaskDataProvider({ children }: { children: ReactNode }) {
  const {
    tasks,
    grouped,
    loading,
    error,
    addTask,
    removeTask,
    updateTask,
    updateProject,
    addManualProject,
    worldForProjectId,
    refetch: fetchTasks,
  } = useTasks();
  const { stuffProjectsEnabled } = useStuffProjects();
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [longTasksWithSessions, setLongTasksWithSessions] = useState<Task[]>(
    []
  );

  // When stuff projects are disabled, hide stuff-world tasks everywhere the UI
  // reads from, so nothing stuff leaks through. When enabled they flow normally
  // (e.g. a "soon" stuff task still surfaces in Good Morning). The setting is
  // the sole gate. Mutation handlers still operate on the unfiltered state.
  const isStuff = (t: Task) => t.project?.world?.systemKey === "stuff";
  const withoutStuff = (list: Task[]) =>
    stuffProjectsEnabled ? list : list.filter((t) => !isStuff(t));
  const isStuffProject = (p: Project) => p.world?.systemKey === "stuff";
  const withoutStuffProjects = <T extends Project>(list: T[]) =>
    stuffProjectsEnabled ? list : list.filter((p) => !isStuffProject(p));

  // completed/upcoming/long tasks are fetched separately with a shallow project,
  // so stitch the world object onto them the way useTasks does for active tasks
  // (the invoicing/done views and the stuff filter read task.project.world).
  const enrichWorld = (task: Task): Task =>
    task.project?.documentId
      ? { ...task, project: { ...task.project, world: worldForProjectId(task.project.documentId) } }
      : task;

  // Stuff tasks always live in stuff-world projects, so dropping those projects
  // removes every stuff task from the grouped views.
  const visibleGrouped: GroupedTasks = stuffProjectsEnabled
    ? grouped
    : {
        ...grouped,
        projects: withoutStuffProjects(grouped.projects),
        recurringProjects: withoutStuffProjects(grouped.recurringProjects),
        allRecurringProjects: withoutStuffProjects(grouped.allRecurringProjects),
      };
  const visibleCompletedTasks = withoutStuff(completedTasks);
  const visibleUpcomingTasks = withoutStuff(upcomingTasks);
  const visibleLongTasksWithSessions = withoutStuff(longTasksWithSessions);
  const [recentStats, setRecentStats] = useState<RecentStatItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [recentStats30Days, setRecentStats30Days] = useState<RecentStatItem[]>(
    []
  );
  const [statsLoading30Days, setStatsLoading30Days] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const { views } = useViews();
  const pathname = usePathname();
  const { drawerContent, openTaskForm, openProjectForm, closeDrawer } =
    useTaskActions();
  const { timezone } = useTimezoneContext();

  // The active view slug, derived from the route: /todo shows the default view,
  // /todo/view/<slug> shows that one. Only the "done" preset needs the secondary
  // completed/upcoming/stats fetches below.
  const viewMatch = pathname.match(/^\/todo\/view\/(.+)$/);
  const activeViewSlug = viewMatch
    ? decodeURIComponent(viewMatch[1])
    : pathname === "/todo"
      ? getDefaultViewSlug(views, stuffProjectsEnabled)
      : null;

  useEffect(() => {
    if (activeViewSlug === "done") {
      fetchCompletedTasks();
      fetchUpcomingTasks();
      fetchLongTasksWithSessions();
      fetchRecentStats();
      fetchRecentStats30Days();
    }
  }, [activeViewSlug]);

  // Reset editing state when drawer closes
  useEffect(() => {
    if (drawerContent === null) {
      setEditingTask(null);
      setEditingProject(null);
    }
  }, [drawerContent]);

  const fetchCompletedTasks = async (days: number = 30) => {
    try {
      const response = await fetch(`/api/tasks/completed?days=${days}`);
      const result = await response.json();

      if (result.success) {
        const allCompletedTasks: Task[] = result.data;
        setCompletedTasks(allCompletedTasks.map(enrichWorld));
      }
    } catch (err) {
      console.error("Error fetching completed tasks:", err);
      setCompletedTasks([]);
    }
  };

  const fetchUpcomingTasks = async () => {
    try {
      const response = await fetch("/api/tasks/upcoming");
      const result = await response.json();

      if (result.success) {
        const allUpcomingTasks: Task[] = result.data;
        setUpcomingTasks(allUpcomingTasks.map(enrichWorld));
      }
    } catch (err) {
      console.error("Error fetching upcoming tasks:", err);
      setUpcomingTasks([]);
    }
  };

  const fetchLongTasksWithSessions = async (days: number = 30) => {
    try {
      const response = await fetch(`/api/tasks/long-with-sessions?days=${days}`);
      const result = await response.json();

      if (result.success) {
        setLongTasksWithSessions(result.data.map(enrichWorld));
      }
    } catch (err) {
      console.error("Error fetching long tasks with sessions:", err);
      setLongTasksWithSessions([]);
    }
  };

  const fetchRecentStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch("/api/tasks/stats?days=7");
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
      const response = await fetch("/api/tasks/stats?days=30");
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
      // Look up the task in the active list first; fall back to completedTasks
      // (which is populated only in "done"/"invoicing" views).
      const currentTask =
        tasks.find((t) => t.documentId === documentId) ||
        completedTasks.find((t) => t.documentId === documentId);

      if (!currentTask) {
        console.error("Task not found");
        return;
      }

      const isCurrentlyCompleted = currentTask.completed;
      let response;
      let result: any;

      if (isCurrentlyCompleted) {
        response = await fetch(`/api/tasks/${documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: false, completedAt: null }),
        });
        if (response.ok) result = await response.json();
      } else {
        response = await fetch(`/api/tasks/${documentId}/complete`, {
          method: "POST",
        });
        if (response.ok) result = await response.json();
      }

      if (!response.ok) return;

      const newCompletedState = !isCurrentlyCompleted;
      const taskIsInActiveList = tasks.some((t) => t.documentId === documentId);

      if (taskIsInActiveList) {
        // Toggle completed/completedAt on the single source of truth.
        const currentInActive = tasks.find((t) => t.documentId === documentId);
        if (currentInActive) {
          updateTask({
            ...currentInActive,
            completed: newCompletedState,
            completedAt: newCompletedState ? getISOTimestampInEST() : null,
          });
        }
      }

      // Maintain the separate `completedTasks` list used only by the "done"
      // and "invoicing" views.
      if (isCurrentlyCompleted) {
        // Uncompleting: drop from completedTasks.
        setCompletedTasks((prev) =>
          prev.filter((t) => t.documentId !== documentId)
        );
        // If the task was visible only in completedTasks (not in active
        // tasks), splice it back into the active list so it appears once the
        // user switches views.
        if (!taskIsInActiveList) {
          const uncompletedTask: Task = result?.data || {
            ...currentTask,
            completed: false,
            completedAt: null,
          };
          addTask(uncompletedTask);
        }
      } else if (
        activeViewSlug === "done"
      ) {
        // Completing while viewing "done"/"invoicing": add to completedTasks
        // so it appears in the completed list immediately.
        const completedTask: Task = {
          ...currentTask,
          completed: true,
          completedAt: getISOTimestampInEST(),
        };
        setCompletedTasks((prev) => [completedTask, ...prev]);
      }

      // If completing a recurring task created the next occurrence, add it.
      if (result?.newTask) {
        addTask(result.newTask);
      }
    } catch (err) {
      console.error("Error completing task:", err);
      // On error, re-fetch to ensure UI is in sync
      await fetchTasks();
    }
  };

  const handleEdit = (task: Task) => {
    // Check if this is a "worked on" virtual entry
    // Pattern: originalDocumentId-worked-YYYY-MM-DD
    const workedOnMatch = task.documentId.match(
      /^(.+)-worked-(\d{4}-\d{2}-\d{2})$/
    );

    if (workedOnMatch) {
      // This is a "worked on" entry, find the original task
      const originalDocumentId = workedOnMatch[1];
      const originalTask = longTasksWithSessions.find(
        (t) => t.documentId === originalDocumentId
      );

      if (originalTask) {
        setEditingTask(originalTask);
      } else {
        console.error(
          "Could not find original task for worked on entry:",
          originalDocumentId
        );
        setEditingTask(task);
      }
    } else {
      setEditingTask(task);
    }

    openTaskForm();
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    openProjectForm();
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      // Pattern: originalDocumentId-worked-YYYY-MM-DD (a "worked on" virtual entry)
      const workedOnMatch = documentId.match(
        /^(.+)-worked-(\d{4}-\d{2}-\d{2})$/
      );
      const actualDocumentId = workedOnMatch ? workedOnMatch[1] : documentId;

      const response = await fetch(`/api/tasks/${actualDocumentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        removeTask(actualDocumentId);

        if (activeViewSlug === "done") {
          setCompletedTasks((prev) =>
            prev.filter((t) => t.documentId !== actualDocumentId)
          );
          setUpcomingTasks((prev) =>
            prev.filter((t) => t.documentId !== actualDocumentId)
          );
          setLongTasksWithSessions((prev) =>
            prev.filter((t) => t.documentId !== actualDocumentId)
          );
        }
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleWorkSession = async (documentId: string) => {
    try {
      const response = await fetch(`/api/tasks/${documentId}/work-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timezone }),
      });

      if (response.ok) {
        // Refresh tasks to apply phase-based visibility logic
        await fetchTasks(false);
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
        `/api/tasks/${originalDocumentId}/work-session/${date}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Optimistically remove the "worked on" entry from longTasksWithSessions
        if (activeViewSlug === "done") {
          setLongTasksWithSessions(
            (prev) =>
              prev
                .map((task) => {
                  if (
                    task.documentId === originalDocumentId &&
                    task.workSessions
                  ) {
                    return {
                      ...task,
                      workSessions: task.workSessions.filter(
                        (ws) => ws.date !== date
                      ),
                    };
                  }
                  return task;
                })
                .filter(
                  (task) => !task.workSessions || task.workSessions.length > 0
                ) // Remove tasks with no sessions left
          );
        }

        // Refresh the main tasks in the background (without showing loading state)
        await fetchTasks(false);
      }
    } catch (err) {
      console.error("Error removing work session:", err);
    }
  };

  const handleSkipRecurring = async (documentId: string) => {
    try {
      const response = await fetch(`/api/tasks/${documentId}/skip`, {
        method: "POST",
      });

      if (response.ok) {
        // The skipped occurrence is gone; the new occurrence will appear on
        // the next fetchTasks when its displayDate arrives.
        removeTask(documentId);
      }
    } catch (err) {
      console.error("Error skipping recurring task:", err);
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const url = editingTask
        ? `/api/tasks/${editingTask.documentId}`
        : "/api/tasks";

      const method = editingTask ? "PUT" : "POST";

      // Store editingTask reference before clearing
      const wasEditingTask = editingTask;

      // Close drawer and reset form immediately (optimistic update)
      closeDrawer();
      setEditingTask(null);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedTask: Task = result.data;

        // The task may live in the "done" view's separate state arrays. Update
        // those directly so the user sees their edit reflected there too.
        const isInCompletedTasks =
          wasEditingTask &&
          completedTasks.some(
            (t) => t.documentId === wasEditingTask.documentId
          );
        const isInLongTasks =
          wasEditingTask &&
          longTasksWithSessions.some(
            (t) => t.documentId === wasEditingTask.documentId
          );

        if (isInCompletedTasks && updatedTask) {
          setCompletedTasks((prev) =>
            prev.map((t) =>
              t.documentId === wasEditingTask.documentId ? updatedTask : t
            )
          );
        }

        if (isInLongTasks && updatedTask) {
          setLongTasksWithSessions((prev) =>
            prev.map((t) =>
              t.documentId === wasEditingTask.documentId ? updatedTask : t
            )
          );
        }

        if (!isInCompletedTasks && !isInLongTasks) {
          if (wasEditingTask) {
            updateTask(updatedTask);
          } else {
            addTask(updatedTask);
          }
        }
      }
    } catch (err) {
      console.error("Error saving task:", err);
    }
  };

  const handleCancelForm = () => {
    closeDrawer();
    setEditingTask(null);
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
          // Propagate metadata to every task that references this project; the
          // grouping useMemo will recompute layout placement automatically.
          updateProject(updatedProject);
        } else {
          // New project created with no tasks yet. Show it in its world's view
          // until the next fetchTasks clears the manualProjects overlay; the
          // engine's world filtering decides where it appears.
          addManualProject(updatedProject);
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

  return (
    <TaskDataContext.Provider
      value={{
        tasks,
        grouped: visibleGrouped,
        loading,
        error,
        completedTasks: visibleCompletedTasks,
        upcomingTasks: visibleUpcomingTasks,
        longTasksWithSessions: visibleLongTasksWithSessions,
        recentStats,
        statsLoading,
        recentStats30Days,
        statsLoading30Days,
        editingTask,
        editingProject,
        onComplete: handleComplete,
        onEdit: handleEdit,
        onEditProject: handleEditProject,
        onDelete: handleDelete,
        onWorkSession: handleWorkSession,
        onRemoveWorkSession: handleRemoveWorkSession,
        onSkipRecurring: handleSkipRecurring,
        onSubmitTask: handleFormSubmit,
        onCancelTaskForm: handleCancelForm,
        onSubmitProject: handleProjectFormSubmit,
        onCancelProjectForm: handleCancelProjectForm,
      }}
    >
      {children}
    </TaskDataContext.Provider>
  );
}

export function useTaskData() {
  const context = useContext(TaskDataContext);
  if (context === undefined) {
    throw new Error("useTaskData must be used within a TaskDataProvider");
  }
  return context;
}
