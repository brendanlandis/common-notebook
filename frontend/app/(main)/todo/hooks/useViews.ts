'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { View, ViewInput } from '@/app/types/index';
import { sortViewsByPosition } from '@/app/lib/views';
import { apiFetch, apiSend, swallow } from '@/app/lib/apiFetch';

// The current user's views (the user-populated `api::view.view` collection): the
// To Do view-picker, the per-view routes (/todo, /todo/view/<slug>) that resolve
// a slug to a ruleset, and the Settings management UI all read from here. Mirrors
// useWorlds — the query cache is the shared state, so there is no provider.

export const VIEWS_QUERY_KEY = ['views'] as const;

interface ViewsResponse {
  success?: boolean;
  data?: View[];
}

interface ViewResponse {
  success?: boolean;
  data?: View;
}

export function useViews() {
  const queryClient = useQueryClient();

  const { data: views = [], isPending: loading } = useQuery({
    queryKey: VIEWS_QUERY_KEY,
    queryFn: () => apiFetch<ViewsResponse>('/api/views'),
    select: (body) => sortViewsByPosition(body.data ?? []),
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: VIEWS_QUERY_KEY }),
    [queryClient]
  );


  const createMutation = useMutation({
    mutationFn: (data: ViewInput) => apiSend<ViewResponse>('/api/views', 'POST', data),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: ViewInput }) =>
      apiSend<ViewResponse>(`/api/views/${documentId}`, 'PUT', data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiSend(`/api/views/${documentId}`, 'DELETE'),
    onSuccess: invalidate,
  });

  // Strapi has no batch update, so a reorder is N PUTs. A position-only PUT leaves
  // each view's sections untouched. `onMutate` shows the new order at once and
  // `onError` puts the old one back — before, a partial failure left the wrong
  // order on screen until the trailing refetch happened to correct it.
  const reorderMutation = useMutation({
    mutationFn: (orderedDocumentIds: string[]) =>
      Promise.all(
        orderedDocumentIds.map((id, i) => apiSend(`/api/views/${id}`, 'PUT', { position: i }))
      ),
    onMutate: async (orderedDocumentIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: VIEWS_QUERY_KEY });
      const previous = queryClient.getQueryData<ViewsResponse>(VIEWS_QUERY_KEY);

      queryClient.setQueryData<ViewsResponse>(VIEWS_QUERY_KEY, (old) => {
        if (!old?.data) return old;
        const byId = new Map(old.data.map((v) => [v.documentId, v]));
        const reordered = orderedDocumentIds
          .map((id, i) => {
            const view = byId.get(id);
            return view ? { ...view, position: i } : undefined;
          })
          .filter((v): v is View => v !== undefined);
        return { ...old, data: reordered };
      });

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(VIEWS_QUERY_KEY, context.previous);
      }
    },
    onSettled: invalidate,
  });

  // No consumer reads a return value from these, so they resolve to void; the
  // query cache is what the UI re-renders from.
  const createView = useCallback(
    (data: ViewInput) => swallow('create view', createMutation.mutateAsync(data)),
    [createMutation]
  );

  const updateView = useCallback(
    (documentId: string, data: ViewInput) =>
      swallow('update view', updateMutation.mutateAsync({ documentId, data })),
    [updateMutation]
  );

  const deleteView = useCallback(
    (documentId: string) => swallow('delete view', deleteMutation.mutateAsync(documentId)),
    [deleteMutation]
  );

  const reorderViews = useCallback(
    (orderedDocumentIds: string[]) =>
      swallow('persist view order', reorderMutation.mutateAsync(orderedDocumentIds)),
    [reorderMutation]
  );

  return { views, loading, createView, updateView, deleteView, reorderViews };
}
