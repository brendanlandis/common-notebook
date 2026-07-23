'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectImportance, Task } from '@/app/types/index';
import { apiFetch, apiSend } from '@/app/lib/apiFetch';
import { PROJECTS_QUERY_KEY } from '@/app/hooks/useProjects';
import { TASKS_ROOT } from '@/app/(main)/todo/hooks/useTasks';
import { completedTasksKey, COMPLETED_TASK_DAYS } from '@/app/(main)/todo/hooks/useTaskLists';

// Data + mutations for the Manage Projects drawer.
//
// Sections 1-3 read the already-loaded project + task caches (useTasks) directly
// in the component. This hook owns the two things they don't: the paged list of
// *completed* projects (section 4 — deliberately not in the app-wide ['projects']
// query, which excludes completed projects to stay lean), and the writes.
//
// Every mutation just PUTs and invalidates the ['projects'] and ['tasks'] roots.
// Invalidation (rather than the hand-rolled optimistic cache writes useTasks uses
// on the hot path) is fine here — the drawer isn't perf-critical, and a refetch
// naturally picks up the server-side top-of-mind demotion a promote triggers.

export const COMPLETED_PROJECTS_KEY = [...PROJECTS_QUERY_KEY, 'completed'] as const;

interface CompletedPage {
  success?: boolean;
  data?: Project[];
  page: number;
  hasMore: boolean;
}

export function useManageProjects(search: string) {
  const queryClient = useQueryClient();

  // Section 4 is shown by default (the 10 most recently completed), so the query
  // runs as soon as the drawer opens.
  const completedQuery = useInfiniteQuery({
    queryKey: [...COMPLETED_PROJECTS_KEY, search] as const,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam) });
      if (search.trim()) params.set('q', search.trim());
      return apiFetch<CompletedPage>(`/api/projects/completed?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const completedProjects: Project[] =
    completedQuery.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  // Recently-completed tasks (shares the Done view's cache key), used to order
  // section 1 by each project's most recent task completion. The active-tasks
  // list can't supply this: a done project's completed tasks are only there
  // within the visibility window (0 minutes on some accounts).
  const completedTasksQuery = useQuery({
    queryKey: completedTasksKey(COMPLETED_TASK_DAYS),
    queryFn: () =>
      apiFetch<{ success?: boolean; data?: Task[] }>(
        `/api/tasks/completed?days=${COMPLETED_TASK_DAYS}`
      ),
  });
  const recentlyCompletedTasks: Task[] = completedTasksQuery.data?.data ?? [];

  // One place for the shared invalidation. Completing/reviving a project changes
  // which tasks the views show (an abandoned project's tasks leave), so ['tasks']
  // is invalidated too — no visibility-window caveat applies to project writes.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: TASKS_ROOT });
  };

  const put = (documentId: string, data: Record<string, unknown>) =>
    apiSend(`/api/projects/${documentId}`, 'PUT', data);

  const completeMutation = useMutation({
    mutationFn: (documentId: string) => put(documentId, { complete: true }),
    onSuccess: invalidate,
  });

  const reviveMutation = useMutation({
    mutationFn: (documentId: string) => put(documentId, { complete: false }),
    onSuccess: invalidate,
  });

  const importanceMutation = useMutation({
    mutationFn: ({ documentId, importance }: { documentId: string; importance: ProjectImportance }) =>
      put(documentId, { importance }),
    onSuccess: invalidate,
  });

  const saveMutation = useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: Record<string, unknown> }) =>
      put(documentId, data),
    onSuccess: invalidate,
  });

  return {
    completedProjects,
    recentlyCompletedTasks,
    completedLoading: completedQuery.isLoading,
    completedError: completedQuery.error,
    fetchMoreCompleted: completedQuery.fetchNextPage,
    hasMoreCompleted: completedQuery.hasNextPage,
    fetchingMoreCompleted: completedQuery.isFetchingNextPage,

    completeProject: (documentId: string) => completeMutation.mutateAsync(documentId),
    reviveProject: (documentId: string) => reviveMutation.mutateAsync(documentId),
    setImportance: (documentId: string, importance: ProjectImportance) =>
      importanceMutation.mutateAsync({ documentId, importance }),
    saveProject: (documentId: string, data: Record<string, unknown>) =>
      saveMutation.mutateAsync({ documentId, data }),
    busy:
      completeMutation.isPending ||
      reviveMutation.isPending ||
      importanceMutation.isPending ||
      saveMutation.isPending,
  };
}
