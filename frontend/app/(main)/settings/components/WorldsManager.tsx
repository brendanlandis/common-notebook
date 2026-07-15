"use client";

import { useEffect, useState } from "react";
import type { Project, World } from "@/app/types/index";
import { useWorlds } from "@/app/contexts/WorldsContext";

// Create / rename / reorder / delete the user's worlds. Deletion is blocked
// while any project still references the world (a count is shown instead); the
// stuff world (systemKey) can be renamed and reordered but not deleted.
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

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= worlds.length) return;
    const order = worlds.map((w) => w.documentId);
    [order[index], order[target]] = [order[target], order[index]];
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
    <div className="worlds-manager">
      <ul className="worlds-list">
        {worlds.map((world, i) => {
          const count = projectCounts[world.documentId] ?? 0;
          const isStuff = world.systemKey === "stuff";
          return (
            <li key={world.documentId} className="world-row">
              <input
                type="text"
                defaultValue={world.title}
                onBlur={(e) => handleRename(world, e.target.value)}
                disabled={busy}
                aria-label="world name"
              />
              <button
                type="button"
                onClick={() => handleMove(i, -1)}
                disabled={busy || i === 0}
                aria-label="move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => handleMove(i, 1)}
                disabled={busy || i === worlds.length - 1}
                aria-label="move down"
              >
                ↓
              </button>
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
            </li>
          );
        })}
      </ul>

      <div className="worlds-manager-add">
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
