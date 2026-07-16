"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { View, ViewInput } from "@/app/types/index";
import { sortViewsByPosition } from "@/app/lib/views";

// Provides the current user's views (the user-populated `api::view.view`
// collection) app-wide: the To Do view-picker, the per-view routes
// (/todo, /todo/view/<slug>) that resolve a slug to a ruleset, and the Settings
// management UI all read from here. Fetched once and mutated in place so a
// create/rename/reorder shows immediately. Mirrors WorldsContext.

interface ViewsContextType {
  views: View[];
  loading: boolean;
  refetch: () => Promise<void>;
  createView: (data: ViewInput) => Promise<View | null>;
  updateView: (documentId: string, data: ViewInput) => Promise<View | null>;
  deleteView: (documentId: string) => Promise<boolean>;
  /** Persist a new ordering (array of documentIds in the desired order). */
  reorderViews: (orderedDocumentIds: string[]) => Promise<void>;
}

const ViewsContext = createContext<ViewsContextType | undefined>(undefined);

const JSON_HEADERS = { "Content-Type": "application/json" };

export function ViewsProvider({ children }: { children: ReactNode }) {
  const [views, setViews] = useState<View[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/views");
      const body = await res.json();
      if (body.success) setViews(sortViewsByPosition(body.data as View[]));
    } catch (e) {
      console.error("Failed to fetch views:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createView = useCallback(
    async (data: ViewInput) => {
      try {
        const res = await fetch("/api/views", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        });
        const body = await res.json();
        if (body.success) {
          await refetch();
          return body.data as View;
        }
      } catch (e) {
        console.error("Failed to create view:", e);
      }
      return null;
    },
    [refetch]
  );

  const updateView = useCallback(
    async (documentId: string, data: ViewInput) => {
      try {
        const res = await fetch(`/api/views/${documentId}`, {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        });
        const body = await res.json();
        if (body.success) {
          await refetch();
          return body.data as View;
        }
      } catch (e) {
        console.error("Failed to update view:", e);
      }
      return null;
    },
    [refetch]
  );

  const deleteView = useCallback(
    async (documentId: string) => {
      try {
        const res = await fetch(`/api/views/${documentId}`, { method: "DELETE" });
        const body = await res.json();
        if (body.success) {
          await refetch();
          return true;
        }
      } catch (e) {
        console.error("Failed to delete view:", e);
      }
      return false;
    },
    [refetch]
  );

  const reorderViews = useCallback(
    async (orderedDocumentIds: string[]) => {
      // Optimistic: reflect the new order immediately, then persist each
      // position. Strapi has no batch update, so this is N PUTs (fine at this
      // scale — a user has a handful of views). A position-only PUT leaves each
      // view's sections untouched.
      setViews((prev) => {
        const byId = new Map(prev.map((v) => [v.documentId, v]));
        return orderedDocumentIds
          .map((id, i) => {
            const v = byId.get(id);
            return v ? { ...v, position: i } : undefined;
          })
          .filter((v): v is View => v !== undefined);
      });
      try {
        await Promise.all(
          orderedDocumentIds.map((id, i) =>
            fetch(`/api/views/${id}`, {
              method: "PUT",
              headers: JSON_HEADERS,
              body: JSON.stringify({ position: i }),
            })
          )
        );
      } catch (e) {
        console.error("Failed to persist view order:", e);
      }
      await refetch();
    },
    [refetch]
  );

  return (
    <ViewsContext.Provider
      value={{ views, loading, refetch, createView, updateView, deleteView, reorderViews }}
    >
      {children}
    </ViewsContext.Provider>
  );
}

export function useViews() {
  const context = useContext(ViewsContext);
  if (context === undefined) {
    throw new Error("useViews must be used within a ViewsProvider");
  }
  return context;
}
