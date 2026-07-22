"use client";

import { ReactNode } from "react";
import {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onDragEnd(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      {children}
    </DndContext>
  );
}

/** One sortable list. Several of these can live inside a single provider. */
export function SortableGroup({ ids, children }: { ids: string[]; children: ReactNode }) {
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
