'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project, Task } from '@/app/types/index';
import { apiFetch } from '@/app/lib/apiFetch';

// The current user's projects. /api/tasks only shallow-populates a task's project
// (no worldRef), so this list is also the only source of the World object — the
// task grouping joins against it. Mirrors useViews/useWorlds: the query cache is
// the shared state, so there is no provider.

export const PROJECTS_QUERY_KEY = ['projects'] as const;

export interface ProjectsResponse {
  success?: boolean;
  data?: Project[];
}

/**
 * Stitch a project's World onto a task, from the normalized projects map.
 *
 * Every task list the app fetches (`/api/tasks` and the three "done"-view lists)
 * comes back with a shallow project relation and no world, so each of them has to
 * be joined against `/api/projects` before anything can group or filter by world.
 * This was written twice — once in useTasks and once in TaskDataContext — and the
 * second copy read a ref, so it silently produced `world: null` for every task
 * whenever it ran before the projects fetch resolved.
 */
export function withProjectWorld(task: Task, projectsById: Map<string, Project>): Task {
  const project = task.project as Project | null | undefined;
  if (!project?.documentId) return task;
  return {
    ...task,
    project: { ...project, world: projectsById.get(project.documentId)?.world ?? null },
  };
}

export function useProjects() {
  const {
    data: projects = [],
    isPending: loading,
    error,
  } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => apiFetch<ProjectsResponse>('/api/projects'),
    select: (body) => body.data ?? [],
  });

  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.documentId, p])),
    [projects]
  );

  return { projects, projectsById, loading, error };
}
