"use client";

import TodoSections from "../TodoSections";
import type { LayoutRendererProps } from "./types";

export default function ChoresLayout({
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
    (transformedData.nonRecurringNoProjectSections && transformedData.nonRecurringNoProjectSections.length > 0) ||
    (transformedData.nonRecurringNoProjectIncidentals && transformedData.nonRecurringNoProjectIncidentals.length > 0) ? (
      <TodoSections
        sections={transformedData.nonRecurringNoProjectSections || []}
        incidentals={transformedData.nonRecurringNoProjectIncidentals}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        onWorkSession={onWorkSession}
        onRemoveWorkSession={onRemoveWorkSession}
        onSkipRecurring={onSkipRecurring}
        skippedTodoMap={skippedTodoMap}
        onEditProject={onEditProject}
      />
    ) : null
  );
}


