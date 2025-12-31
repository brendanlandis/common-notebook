"use client";

import TodoSections from "../TodoSections";
import type { LayoutRendererProps } from "./types";

export default function DefaultLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
  onEditProject,
}: LayoutRendererProps) {
  return (
    transformedData.allSections &&
    transformedData.allSections.length > 0 && (
      <TodoSections
        sections={transformedData.allSections}
        incidentals={transformedData.incidentals}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        onWorkSession={onWorkSession}
        onRemoveWorkSession={onRemoveWorkSession}
        onSkipRecurring={onSkipRecurring}
        skippedTodoMap={skippedTodoMap}
        onEditProject={onEditProject}
      />
    )
  );
}
