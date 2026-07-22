"use client";

import { useEffect, useState } from "react";
import type { Project, World } from "@/app/types/index";
import { useWorlds } from "@/app/hooks/useWorlds";
import { SortableProvider, SortableGroup, SortableRow, reorderIds } from "./SortableList";

// Create / rename / reorder / delete the user's worlds. Deletion is blocked
// while any project still references the world (a count is shown instead); the
// stuff world (systemKey) can be renamed and reordered but not deleted.
//
// Reordering is drag-only. `reorderWorlds` already carries the optimistic
// onMutate/onError rollback, so the drag handler's whole job is handing it the
// new documentId order.
export default function WorldsManager() {
  const { worlds, loading, createWorld, updateWorld, deleteWorld, reorderWorlds } = useWorlds();
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  // Count projects per world for the delete guard. Refetched when worlds change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        const body = await res.json();
        if (!cancelled && body.success) {
          const counts: Record<string, number> = {};
          for (const p of body.data as Project[]) {
            const id = p.world?.documentId;
            if (id) counts[id] = (counts[id] ?? 0) + 1;
          }
          setProjectCounts(counts);
        }
      } catch {
        /* non-fatal: the guard just won't have counts */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worlds]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    await createWorld({ title, position: worlds.length });
    setNewTitle("");
    setBusy(false);
  };

  const handleRename = async (world: World, title: string) => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === world.title) return;
    setBusy(true);
    await updateWorld(world.documentId, { title: trimmed });
    setBusy(false);
  };

  const handleDragEnd = async (activeId: string, overId: string) => {
    const order = reorderIds(worlds.map((w) => w.documentId), activeId, overId);
    if (!order) return;
    setBusy(true);
    await reorderWorlds(order);
    setBusy(false);
  };

  const handleDelete = async (world: World) => {
    const count = projectCounts[world.documentId] ?? 0;
    if (count > 0) return;
    if (!confirm(`Delete the "${world.title}" world?`)) return;
    setBusy(true);
    await deleteWorld(world.documentId);
    setBusy(false);
  };

  if (loading) return <p>loading worlds…</p>;

  return (
    <div className="worlds-manager manager">
      <SortableProvider onDragEnd={handleDragEnd}>
        <SortableGroup ids={worlds.map((w) => w.documentId)}>
        <ul className="worlds-list manager-list">
          {worlds.map((world) => {
            const count = projectCounts[world.documentId] ?? 0;
            const isStuff = world.systemKey === "stuff";
            return (
              <SortableRow
                key={world.documentId}
                id={world.documentId}
                className="world-row manager-row"
                handleLabel={`reorder ${world.title}`}
                disabled={busy}
              >
                <input
                  type="text"
                  defaultValue={world.title}
                  onBlur={(e) => handleRename(world, e.target.value)}
                  disabled={busy}
                  aria-label="world name"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(world)}
                  disabled={busy || isStuff || count > 0}
                  title={
                    count > 0
                      ? `${count} project(s) still use this world`
                      : isStuff
                        ? "the stuff world can't be deleted while it exists"
                        : "delete this world"
                  }
                >
                  delete{count > 0 ? ` (${count})` : ""}
                </button>
              </SortableRow>
            );
          })}
        </ul>
        </SortableGroup>
      </SortableProvider>

      <div className="worlds-manager-add manager-add">
        <input
          type="text"
          placeholder="new world"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          disabled={busy}
          aria-label="new world name"
        />
        <button type="button" onClick={handleAdd} disabled={busy || !newTitle.trim()}>
          add world
        </button>
      </div>
    </div>
  );
}
