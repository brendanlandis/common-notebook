'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { World } from '@/app/types/index';
import { sortWorldsByPosition } from '@/app/lib/worlds';
import { apiFetch, apiSend, swallow } from '@/app/lib/apiFetch';

// The current user's worlds (the user-populated `api::world.world` collection):
// the project picker, the view selector, the world sections, and the Settings
// management UI all read from here. The query cache is the shared state — there
// is no provider, so a new consumer just calls the hook.

export const WORLDS_QUERY_KEY = ['worlds'] as const;

interface WorldsResponse {
  success?: boolean;
  data?: World[];
}

interface WorldResponse {
  success?: boolean;
  data?: World;
}

export function useWorlds() {
  const queryClient = useQueryClient();

  const { data: worlds = [], isPending: loading } = useQuery({
    queryKey: WORLDS_QUERY_KEY,
    queryFn: () => apiFetch<WorldsResponse>('/api/worlds'),
    select: (body) => sortWorldsByPosition(body.data ?? []),
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: WORLDS_QUERY_KEY }),
    [queryClient]
  );


  const createMutation = useMutation({
    mutationFn: (data: Partial<World>) => apiSend<WorldResponse>('/api/worlds', 'POST', data),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: Partial<World> }) =>
      apiSend<WorldResponse>(`/api/worlds/${documentId}`, 'PUT', data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiSend(`/api/worlds/${documentId}`, 'DELETE'),
    onSuccess: invalidate,
  });

  // Strapi has no batch update, so a reorder is N PUTs (fine at this scale — a
  // user has a handful of worlds). `onMutate` shows the new order at once and
  // `onError` puts the old one back; before, a partial failure left the wrong
  // order on screen until the trailing refetch happened to correct it.
  const reorderMutation = useMutation({
    mutationFn: (orderedDocumentIds: string[]) =>
      Promise.all(
        orderedDocumentIds.map((id, i) =>
          apiSend(`/api/worlds/${id}`, 'PUT', { position: i })
        )
      ),
    onMutate: async (orderedDocumentIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: WORLDS_QUERY_KEY });
      const previous = queryClient.getQueryData<WorldsResponse>(WORLDS_QUERY_KEY);

      queryClient.setQueryData<WorldsResponse>(WORLDS_QUERY_KEY, (old) => {
        if (!old?.data) return old;
        const byId = new Map(old.data.map((w) => [w.documentId, w]));
        const reordered = orderedDocumentIds
          .map((id, i) => {
            const world = byId.get(id);
            return world ? { ...world, position: i } : undefined;
          })
          .filter((w): w is World => w !== undefined);
        return { ...old, data: reordered };
      });

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(WORLDS_QUERY_KEY, context.previous);
      }
    },
    onSettled: invalidate,
  });

  // No consumer reads a return value from these, so they resolve to void; the
  // query cache is what the UI re-renders from.
  const createWorld = useCallback(
    (data: Partial<World>) => swallow('create world', createMutation.mutateAsync(data)),
    [createMutation]
  );

  const updateWorld = useCallback(
    (documentId: string, data: Partial<World>) =>
      swallow('update world', updateMutation.mutateAsync({ documentId, data })),
    [updateMutation]
  );

  const deleteWorld = useCallback(
    (documentId: string) => swallow('delete world', deleteMutation.mutateAsync(documentId)),
    [deleteMutation]
  );

  const reorderWorlds = useCallback(
    (orderedDocumentIds: string[]) =>
      swallow('persist world order', reorderMutation.mutateAsync(orderedDocumentIds)),
    [reorderMutation]
  );

  return { worlds, loading, createWorld, updateWorld, deleteWorld, reorderWorlds };
}
