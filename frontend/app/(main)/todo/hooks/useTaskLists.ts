"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@/app/types/index";
import { apiFetch } from "@/app/lib/apiFetch";
import { useProjects, withProjectWorld } from "@/app/hooks/useProjects";
import { TASKS_ROOT } from "./useTasks";

// The four secondary task lists behind the "done" view: what was completed, what
// is coming up, which long tasks have work sessions, and the two stats panels.
//
// They are fetched only on that view, which `enabled` preserves — it replaces an
// effect that re-ran all five fetches on every navigation to /todo/view/done.
// Switching away and back inside staleTime now serves the cache instead.

// Stats shape used by the "done" view's RecentStats panels.
export type RecentStatItem = {
  type: "project" | "category";
  name: string;
  count: number;
};

// Exported: the complete mutation has to name the same key to update the list it
// just changed.
export const COMPLETED_TASK_DAYS = 30;
const LONG_TASK_DAYS = 30;
const RECENT_STATS_DAYS = 7;
const RECENT_STATS_30_DAYS = 30;

// Nested under the same ['tasks'] root as the active list, so completing a task can
// invalidate every one of these with a single call rather than naming each.
export const completedTasksKey = (days: number) => [...TASKS_ROOT, "completed", days] as const;
export const UPCOMING_TASKS_KEY = [...TASKS_ROOT, "upcoming"] as const;
export const longTasksKey = (days: number) => [...TASKS_ROOT, "long-with-sessions", days] as const;
export const statsKey = (days: number) => [...TASKS_ROOT, "stats", days] as const;

interface TasksResponse {
  success?: boolean;
  data?: Task[];
}

interface StatsResponse {
  success?: boolean;
  data?: RecentStatItem[];
}

export type TaskListUpdater = (previous: Task[]) => Task[];

export function useTaskLists(enabled: boolean) {
  const queryClient = useQueryClient();
  const { projectsById } = useProjects();

  const completedQuery = useQuery({
    queryKey: completedTasksKey(COMPLETED_TASK_DAYS),
    queryFn: () => apiFetch<TasksResponse>(`/api/tasks/completed?days=${COMPLETED_TASK_DAYS}`),
    enabled,
  });

  const upcomingQuery = useQuery({
    queryKey: UPCOMING_TASKS_KEY,
    queryFn: () => apiFetch<TasksResponse>("/api/tasks/upcoming"),
    enabled,
  });

  const longTasksQuery = useQuery({
    queryKey: longTasksKey(LONG_TASK_DAYS),
    queryFn: () =>
      apiFetch<TasksResponse>(`/api/tasks/long-with-sessions?days=${LONG_TASK_DAYS}`),
    enabled,
  });

  const statsQuery = useQuery({
    queryKey: statsKey(RECENT_STATS_DAYS),
    queryFn: () => apiFetch<StatsResponse>(`/api/tasks/stats?days=${RECENT_STATS_DAYS}`),
    enabled,
  });

  const stats30Query = useQuery({
    queryKey: statsKey(RECENT_STATS_30_DAYS),
    queryFn: () => apiFetch<StatsResponse>(`/api/tasks/stats?days=${RECENT_STATS_30_DAYS}`),
    enabled,
  });

  // These lists are fetched with a shallow project, so the world is joined on here
  // exactly as the active list does it. Derived from whatever the projects query
  // currently holds, rather than from a ref that may not have been written yet.
  const enrich = useCallback(
    (tasks: Task[]) => tasks.map((task) => withProjectWorld(task, projectsById)),
    [projectsById]
  );

  const completedTasks = useMemo(
    () => enrich(completedQuery.data?.data ?? []),
    [completedQuery.data, enrich]
  );
  const upcomingTasks = useMemo(
    () => enrich(upcomingQuery.data?.data ?? []),
    [upcomingQuery.data, enrich]
  );
  const longTasksWithSessions = useMemo(
    () => enrich(longTasksQuery.data?.data ?? []),
    [longTasksQuery.data, enrich]
  );

  const setListData = useCallback(
    (key: readonly unknown[], updater: TaskListUpdater) => {
      queryClient.setQueryData<TasksResponse>(key, (old) =>
        old?.data ? { ...old, data: updater(old.data) } : old
      );
    },
    [queryClient]
  );

  const setCompletedTasks = useCallback(
    (updater: TaskListUpdater) => setListData(completedTasksKey(COMPLETED_TASK_DAYS), updater),
    [setListData]
  );
  const setUpcomingTasks = useCallback(
    (updater: TaskListUpdater) => setListData(UPCOMING_TASKS_KEY, updater),
    [setListData]
  );
  const setLongTasksWithSessions = useCallback(
    (updater: TaskListUpdater) => setListData(longTasksKey(LONG_TASK_DAYS), updater),
    [setListData]
  );

  return {
    completedTasks,
    upcomingTasks,
    longTasksWithSessions,
    recentStats: statsQuery.data?.data ?? [],
    // isFetching, not isPending: a disabled query is pending forever, which would
    // read as "loading" on every view that never asks for stats.
    statsLoading: statsQuery.isFetching,
    recentStats30Days: stats30Query.data?.data ?? [],
    statsLoading30Days: stats30Query.isFetching,
    setCompletedTasks,
    setUpcomingTasks,
    setLongTasksWithSessions,
  };
}
