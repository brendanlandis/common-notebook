"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { World } from "@/app/types/index";
import { sortWorldsByPosition } from "@/app/lib/worlds";

// Provides the current user's worlds (the user-populated `api::world.world`
// collection) app-wide: the project picker, the view selector, the world
// sections, and the Settings management UI all read from here. Fetched once and
// mutated in place so a create/rename/reorder shows immediately.

interface WorldsContextType {
  worlds: World[];
  loading: boolean;
  refetch: () => Promise<void>;
  createWorld: (data: Partial<World>) => Promise<World | null>;
  updateWorld: (documentId: string, data: Partial<World>) => Promise<World | null>;
  deleteWorld: (documentId: string) => Promise<boolean>;
  /** Persist a new ordering (array of documentIds in the desired order). */
  reorderWorlds: (orderedDocumentIds: string[]) => Promise<void>;
}

const WorldsContext = createContext<WorldsContextType | undefined>(undefined);

const JSON_HEADERS = { "Content-Type": "application/json" };

export function WorldsProvider({ children }: { children: ReactNode }) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/worlds");
      const body = await res.json();
      if (body.success) setWorlds(sortWorldsByPosition(body.data as World[]));
    } catch (e) {
      console.error("Failed to fetch worlds:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createWorld = useCallback(
    async (data: Partial<World>) => {
      try {
        const res = await fetch("/api/worlds", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        });
        const body = await res.json();
        if (body.success) {
          await refetch();
          return body.data as World;
        }
      } catch (e) {
        console.error("Failed to create world:", e);
      }
      return null;
    },
    [refetch]
  );

  const updateWorld = useCallback(
    async (documentId: string, data: Partial<World>) => {
      try {
        const res = await fetch(`/api/worlds/${documentId}`, {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        });
        const body = await res.json();
        if (body.success) {
          await refetch();
          return body.data as World;
        }
      } catch (e) {
        console.error("Failed to update world:", e);
      }
      return null;
    },
    [refetch]
  );

  const deleteWorld = useCallback(
    async (documentId: string) => {
      try {
        const res = await fetch(`/api/worlds/${documentId}`, { method: "DELETE" });
        const body = await res.json();
        if (body.success) {
          await refetch();
          return true;
        }
      } catch (e) {
        console.error("Failed to delete world:", e);
      }
      return false;
    },
    [refetch]
  );

  const reorderWorlds = useCallback(
    async (orderedDocumentIds: string[]) => {
      // Optimistic: reflect the new order immediately, then persist each
      // position. Strapi has no batch update, so this is N PUTs (fine at this
      // scale — a user has a handful of worlds).
      setWorlds((prev) => {
        const byId = new Map(prev.map((w) => [w.documentId, w]));
        return orderedDocumentIds
          .map((id, i) => {
            const w = byId.get(id);
            return w ? { ...w, position: i } : undefined;
          })
          .filter((w): w is World => w !== undefined);
      });
      try {
        await Promise.all(
          orderedDocumentIds.map((id, i) =>
            fetch(`/api/worlds/${id}`, {
              method: "PUT",
              headers: JSON_HEADERS,
              body: JSON.stringify({ position: i }),
            })
          )
        );
      } catch (e) {
        console.error("Failed to persist world order:", e);
      }
      await refetch();
    },
    [refetch]
  );

  return (
    <WorldsContext.Provider
      value={{ worlds, loading, refetch, createWorld, updateWorld, deleteWorld, reorderWorlds }}
    >
      {children}
    </WorldsContext.Provider>
  );
}

export function useWorlds() {
  const context = useContext(WorldsContext);
  if (context === undefined) {
    throw new Error("useWorlds must be used within a WorldsProvider");
  }
  return context;
}
