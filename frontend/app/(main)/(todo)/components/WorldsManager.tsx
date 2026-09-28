"use client";

import { useEffect, useState } from "react";
import type { Project, World } from "@/app/types/index";
import { useWorlds } from "@/app/(main)/(todo)/hooks/useWorlds";
import { Input } from "@/app/components/ui/FormControls";
import Button from "@/app/components/ui/Button";
import DeleteButton from "@/app/components/ui/DeleteButton";
import DrawerSection from "@/app/components/ui/DrawerSection";
import { SortableProvider, SortableGroup, SortableRow, reorderIds } from "@/app/components/ui/SortableList";

// Create / rename / reorder / delete the user's worlds. Deletion is blocked
// while any project still references the world (pressing its trash can says
// how many); the stuff world (systemKey) can be renamed and reordered but not
// deleted.
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
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        const body = await res.json();
        if (!canceled && body.success) {
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
      canceled = true;
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

  // DeleteButton has already asked.
  const handleDelete = async (world: World) => {
    const count = projectCounts[world.documentId] ?? 0;
    if (count > 0) return;
    setBusy(true);
    await deleteWorld(world.documentId);
    setBusy(false);
  };

  if (loading) return <p>loading worlds…</p>;

  return (
    <div>
      <DrawerSection>
        <div className="flex flex-wrap items-center gap-controls">
          <Input
            type="text"
            className="min-w-0 flex-[1_1_8rem]"
            placeholder="new world"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            disabled={busy}
            aria-label="new world name"
          />
          <Button onClick={handleAdd} disabled={busy || !newTitle.trim()}>
            add world
          </Button>
        </div>
      </DrawerSection>

      <DrawerSection>
        <SortableProvider onDragEnd={handleDragEnd}>
          <SortableGroup ids={worlds.map((w) => w.documentId)}>
          <ul aria-label="worlds" className="flex flex-col gap-rows">
            {worlds.map((world) => {
              const count = projectCounts[world.documentId] ?? 0;
              const isStuff = world.systemKey === "stuff";
              return (
                <SortableRow
                  key={world.documentId}
                  id={world.documentId}
                  // handle | name | delete
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-controls"
                  handleLabel={`reorder ${world.title}`}
                  disabled={busy}
                >
                  <Input
                    type="text"
                    className="min-w-0"
                    placeholder="world name"
                    defaultValue={world.title}
                    onBlur={(e) => handleRename(world, e.target.value)}
                    disabled={busy}
                    aria-label="world name"
                  />
                  <DeleteButton
                    aria-label={`delete ${world.title}`}
                    question={`Are you sure you want to delete the "${world.title}" world?`}
                    cannot={
                      isStuff
                        ? "The stuff world can't be deleted. To hide it, turn off stuff projects in settings."
                        : count > 0
                          ? `"${world.title}" still has ${count} project${count === 1 ? "" : "s"}. Move them to another world before deleting it.`
                          : undefined
                    }
                    onDelete={() => handleDelete(world)}
                    disabled={busy}
                  />
                </SortableRow>
              );
            })}
          </ul>
          </SortableGroup>
        </SortableProvider>
      </DrawerSection>
    </div>
  );
}
