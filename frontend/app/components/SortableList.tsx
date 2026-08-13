"use client";

import { ReactNode, createContext, useCallback, useContext, useRef } from "react";
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVerticalIcon } from "@phosphor-icons/react";

// Shared drag-to-reorder plumbing for the worlds list, the views list, and the
// sections nested inside each view. It replaced per-row ↑/↓ buttons; the
// KeyboardSensor is not optional, because those buttons were the only
// keyboard-accessible way to reorder and dropping them without it would be a
// straight accessibility regression.
//
// The split between Provider and Group matters: **nested DndContexts do not
// work.** Wrapping each view's sections in their own DndContext left the inner
// rows completely inert — a drag on a section handle never even lifted, because
// the outer context claims the activation. dnd-kit's model is one DndContext per
// interaction surface, with as many SortableContexts inside it as you need. So
// the provider is mounted once per manager and each list is a Group.
//
// The PointerSensor needs an activation distance: these rows are full of text
// inputs, selects and checkboxes, and without it a plain click on a control gets
// swallowed as the start of a drag.

/**
 * Which list each sortable id belongs to.
 *
 * One DndContext serves every list on a surface (nested contexts do not work —
 * see above), so without this every droppable competes with every other. That is
 * a real problem for nested lists rather than a theoretical one: dragging a
 * section between two 450px-tall sections is a ~460px journey, and `closestCorners`
 * compares the dragged rect against the *view* rows too. A view row frequently
 * wins, `over` comes back as a view id, and ViewsManager's cross-view guard
 * correctly refuses the drop — so the rows visibly swap during the drag and then
 * snap back. From the outside it looks like reordering sections is simply broken,
 * and intermittently it was.
 */
const GroupRegistry = createContext<{
  register: (ids: string[], groupKey: string) => void;
  groupOf: (id: string) => string | undefined;
} | null>(null);

export function SortableProvider({
  onDragEnd,
  children,
}: {
  /** Called with the dragged and dropped-on ids; the caller routes it to the
   *  right list (see ViewsManager, which owns two levels). */
  onDragEnd: (activeId: string, overId: string) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // A ref, not state: this is written during render by each Group and read only
  // inside collision detection, so re-rendering the provider on every
  // registration would be churn for nothing.
  const groups = useRef(new Map<string, string>());
  const register = useCallback((ids: string[], groupKey: string) => {
    for (const id of ids) groups.current.set(id, groupKey);
  }, []);
  const groupOf = useCallback((id: string) => groups.current.get(id), []);

  /**
   * `closestCorners`, but only against droppables in the dragged item's own
   * list. Anything in another list is not a legal drop target, so letting it
   * win a collision can only produce a refused drop.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeGroup = groups.current.get(String(args.active.id));
    if (activeGroup === undefined) return closestCorners(args);

    const sameGroup = args.droppableContainers.filter(
      (container) => groups.current.get(String(container.id)) === activeGroup
    );
    // Fall back rather than return nothing if a list somehow has no peers —
    // an empty candidate set would make the drag silently undroppable.
    if (sameGroup.length === 0) return closestCorners(args);

    return closestCorners({ ...args, droppableContainers: sameGroup });
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onDragEnd(String(active.id), String(over.id));
  };

  return (
    <GroupRegistry.Provider value={{ register, groupOf }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        {children}
      </DndContext>
    </GroupRegistry.Provider>
  );
}

/**
 * One sortable list. Several of these can live inside a single provider.
 *
 * `groupKey` identifies the list for collision purposes; it defaults to the
 * ids themselves, which is right whenever the lists are disjoint (they are —
 * a row belongs to exactly one list).
 */
export function SortableGroup({
  ids,
  groupKey,
  children,
}: {
  ids: string[];
  groupKey?: string;
  children: ReactNode;
}) {
  const registry = useContext(GroupRegistry);
  registry?.register(ids, groupKey ?? ids.join("|"));

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

/** Reorder `ids` given the two ends of a drag; null when the drag wasn't ours. */
export function reorderIds(ids: string[], activeId: string, overId: string): string[] | null {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1) return null;
  return arrayMove(ids, from, to);
}

type SortableRowProps = {
  id: string;
  className?: string;
  /** Accessible name for the handle, e.g. "reorder day job". */
  handleLabel: string;
  disabled?: boolean;
  children: ReactNode;
};

/** One draggable row. Only the handle starts a drag, so the row's own inputs
 *  stay clickable and text stays selectable. */
export function SortableRow({
  id,
  className,
  handleLabel,
  disabled,
  children,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      className={`${className ?? ""}${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={handleLabel}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <DotsSixVerticalIcon size={20} weight="bold" />
      </button>
      {children}
    </li>
  );
}
