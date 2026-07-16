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
import { getISOTimestamp } from "@/app/lib/dateUtils";
import { getDefaultViewSlug } from "@/app/lib/views";
import { useViews } from "@/app/hooks/useViews";
import { useTaskActions } from "@/app/contexts/TaskActionsContext";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, swallow } from "@/app/lib/apiFetch";
import { useTasks, TASKS_ROOT, TASKS_ACTIVE_KEY } from "../hooks/useTasks";
import {
  useTaskLists,
  completedTasksKey,
  COMPLETED_TASK_DAYS,
  type RecentStatItem,
} from "../hooks/useTaskLists";

export type { RecentStatItem };

// POST /complete answers { success, newTask } — no `data`; the un-complete PUT
// answers { success, data }.
interface CompleteResult {
  success?: boolean;
  data?: Task;
  newTask?: Task;
}

// `success` is not decoration: apiSend's generic is constrained to ApiBody, whose
// members are all optional, so a shape with no property in common with it is
// rejected outright by TypeScript's weak-type check.
interface TaskSaveResult {
  success?: boolean;
  data?: Task;
}

interface ProjectSaveResult {
  success?: boolean;
  data?: Project;
}

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
    addProject,
    refetch: fetchTasks,
  } = useTasks();
  const { stuffProjectsEnabled } = useStuffProjects();
  const { views } = useViews();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // The active view slug, derived from the route: /todo shows the default view,
  // /todo/view/<slug> shows that one. Only the "done" preset needs the secondary
  // completed/upcoming/stats lists, which is what gates the queries below.
  const viewMatch = pathname.match(/^\/todo\/view\/(.+)$/);
  const activeViewSlug = viewMatch
    ? decodeURIComponent(viewMatch[1])
    : pathname === "/todo"
      ? getDefaultViewSlug(views, stuffProjectsEnabled)
      : null;

  const {
    completedTasks,
    upcomingTasks,
    longTasksWithSessions,
    recentStats,
    statsLoading,
    recentStats30Days,
    statsLoading30Days,
    setCompletedTasks,
    setUpcomingTasks,
    setLongTasksWithSessions,
  } = useTaskLists(activeViewSlug === "done");

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
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const { drawerContent, openTaskForm, openProjectForm, closeDrawer } =
    useTaskActions();
  const { timeZoneSettings } = useDateTimeSettings();

  // Reset editing state when drawer closes
  useEffect(() => {
    if (drawerContent === null) {
      setEditingTask(null);
      setEditingProject(null);
    }
  }, [drawerContent]);

  // Completing is a toggle across two endpoints and two lists. The optimistic flip
  // happens in `onMutate` so the checkbox costs no round trip, and — the part that
  // was missing — `onError` puts the old value back. TaskItem holds `isChecked` as
  // local state synced from `task.completed`, so before this a failed request left
  // the box ticked and lying until something else refetched.
  const completeMutation = useMutation({
    mutationFn: ({
      documentId,
      isCurrentlyCompleted,
    }: {
      documentId: string;
      isCurrentlyCompleted: boolean;
    }) =>
      isCurrentlyCompleted
        ? apiSend<CompleteResult>(`/api/tasks/${documentId}`, "PUT", {
            completed: false,
            completedAt: null,
          })
        : apiSend<CompleteResult>(`/api/tasks/${documentId}/complete`, "POST"),

    onMutate: async ({ documentId, isCurrentlyCompleted }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_ROOT });
      const previousActive = queryClient.getQueryData(TASKS_ACTIVE_KEY);
      const previousCompleted = queryClient.getQueryData(
        completedTasksKey(COMPLETED_TASK_DAYS)
      );

      const currentTask =
        tasks.find((t) => t.documentId === documentId) ??
        completedTasks.find((t) => t.documentId === documentId);
      const taskIsInActiveList = tasks.some((t) => t.documentId === documentId);
      const newCompletedState = !isCurrentlyCompleted;
      const completedAt = newCompletedState ? getISOTimestamp(timeZoneSettings) : null;

      if (taskIsInActiveList && currentTask) {
        updateTask({ ...currentTask, completed: newCompletedState, completedAt });
      }

      // The separate `completedTasks` list, read only by the "done" view.
      if (isCurrentlyCompleted) {
        setCompletedTasks((prev) => prev.filter((t) => t.documentId !== documentId));
        // Visible only in completedTasks: splice it back into the active list so it
        // is there when the user switches views.
        if (!taskIsInActiveList && currentTask) {
          addTask({ ...currentTask, completed: false, completedAt: null });
        }
      } else if (activeViewSlug === "done" && currentTask) {
        setCompletedTasks((prev) => [{ ...currentTask, completed: true, completedAt }, ...prev]);
      }

      return { previousActive, previousCompleted };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousActive !== undefined) {
        queryClient.setQueryData(TASKS_ACTIVE_KEY, context.previousActive);
      }
      if (context?.previousCompleted !== undefined) {
        queryClient.setQueryData(
          completedTasksKey(COMPLETED_TASK_DAYS),
          context.previousCompleted
        );
      }
    },

    onSuccess: (result) => {
      // A recurring task's next occurrence is created server-side and cannot be
      // predicted optimistically, so it arrives here.
      if (result?.newTask) addTask(result.newTask);
    },

    // Deliberately does NOT invalidate ['tasks','active'] — only the lists the
    // "done" view reads. /api/tasks applies the same completed-visibility window
    // server-side, so on an account with a 0-minute window a refetch would drop the
    // task the user has just ticked: the row would vanish under the cursor instead
    // of fading, and un-completing it would become impossible. The optimistic write
    // above already holds the new state; the next real load reconciles it. Same
    // reasoning as saveNotes in usePracticeLogs.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: TASKS_ROOT,
        predicate: (query) => query.queryKey[1] !== "active",
      }),
  });

  const handleComplete = (documentId: string) => {
    const currentTask =
      tasks.find((t) => t.documentId === documentId) ??
      completedTasks.find((t) => t.documentId === documentId);

    if (!currentTask) {
      console.error("Task not found");
      return;
    }

    completeMutation.mutate({
      documentId,
      isCurrentlyCompleted: Boolean(currentTask.completed),
    });
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

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiSend(`/api/tasks/${documentId}`, "DELETE"),
    onSuccess: (_result, actualDocumentId) => {
      removeTask(actualDocumentId);

      if (activeViewSlug === "done") {
        const drop = (prev: Task[]) => prev.filter((t) => t.documentId !== actualDocumentId);
        setCompletedTasks(drop);
        setUpcomingTasks(drop);
        setLongTasksWithSessions(drop);
      }
    },
  });

  const handleDelete = (documentId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    // Pattern: originalDocumentId-worked-YYYY-MM-DD (a "worked on" virtual entry)
    const workedOnMatch = documentId.match(/^(.+)-worked-(\d{4}-\d{2}-\d{2})$/);
    const actualDocumentId = workedOnMatch ? workedOnMatch[1] : documentId;

    swallow("delete task", deleteMutation.mutateAsync(actualDocumentId));
  };

  // No body: the route resolves the timezone from the caller's token. Refetching
  // the active list is the point here rather than a side effect — the phase-based
  // visibility rules are applied over the fresh payload, and that is what makes a
  // long task drop out of the main views once it is worked on.
  const workSessionMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiSend(`/api/tasks/${documentId}/work-session`, "POST"),
    onSuccess: () => fetchTasks(false),
  });

  const removeWorkSessionMutation = useMutation({
    mutationFn: ({
      originalDocumentId,
      date,
    }: {
      originalDocumentId: string;
      date: string;
    }) => apiSend(`/api/tasks/${originalDocumentId}/work-session/${date}`, "DELETE"),
    onSuccess: (_result, { originalDocumentId, date }) => {
      // Drop the "worked on" entry from the done view's list, and the task with it
      // once it has no sessions left.
      if (activeViewSlug === "done") {
        setLongTasksWithSessions((prev) =>
          prev
            .map((task) =>
              task.documentId === originalDocumentId && task.workSessions
                ? {
                    ...task,
                    workSessions: task.workSessions.filter((ws) => ws.date !== date),
                  }
                : task
            )
            .filter((task) => !task.workSessions || task.workSessions.length > 0)
        );
      }
      return fetchTasks(false);
    },
  });

  const skipMutation = useMutation({
    mutationFn: (documentId: string) => apiSend(`/api/tasks/${documentId}/skip`, "POST"),
    // The skipped occurrence is gone; the new one appears on the next fetch, once
    // its displayDate arrives.
    onSuccess: (_result, documentId) => removeTask(documentId),
  });

  const handleWorkSession = async (documentId: string) => {
    await swallow("add work session", workSessionMutation.mutateAsync(documentId));
  };

  const handleRemoveWorkSession = async (originalDocumentId: string, date: string) => {
    await swallow(
      "remove work session",
      removeWorkSessionMutation.mutateAsync({ originalDocumentId, date })
    );
  };

  const handleSkipRecurring = async (documentId: string) => {
    await swallow("skip recurring task", skipMutation.mutateAsync(documentId));
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

      const result = await apiSend<TaskSaveResult>(url, method, data);
      const updatedTask = result.data as Task;

      {

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

      const result = await apiSend<ProjectSaveResult>(url, method, data);
      const updatedProject = result.data as Project;

      if (wasEditingProject) {
        // Propagate metadata to every task that references this project; the
        // grouping useMemo will recompute layout placement automatically.
        updateProject(updatedProject);
      } else {
        // New project, no tasks yet. Splice it into the project list so it is
        // navigable at once; the next refetch returns it from /api/projects, so
        // unlike the overlay this replaced, it does not disappear.
        addProject(updatedProject);
      }
    } catch (err) {
      // The drawer is already closed by this point, so a rejected save still looks
      // identical to a successful one. That is how `projectType: 'normal'` — a value
      // Strapi's enum never allowed — went unnoticed: every edit of an ordinary
      // project 400'd and said nothing. apiSend now throws on both a non-ok status
      // and a {success:false} body, so this catch sees every failure rather than
      // only the thrown ones; surfacing it to the user still needs the drawer to
      // stay open (or a toast). Logging remains the floor.
      console.error("Failed to save project:", err);
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
