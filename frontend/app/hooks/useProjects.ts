'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project } from '@/app/types/index';
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
