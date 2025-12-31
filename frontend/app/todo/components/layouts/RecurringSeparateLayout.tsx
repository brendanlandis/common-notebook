"use client";

import TodoSections from "../TodoSections";
import type { LayoutRendererProps } from "./types";

export default function RecurringSeparateLayout({
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
    <>
      {transformedData.recurringSections &&
        transformedData.recurringSections.length > 0 && (
          <TodoSections
            sections={transformedData.recurringSections}
            incidentals={transformedData.recurringIncidentals}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            skippedTodoMap={skippedTodoMap}
            onEditProject={onEditProject}
          />
        )}

      {transformedData.nonRecurringSections &&
        transformedData.nonRecurringSections.length > 0 && (
          <TodoSections
            sections={transformedData.nonRecurringSections}
            incidentals={transformedData.nonRecurringIncidentals}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            skippedTodoMap={skippedTodoMap}
            onEditProject={onEditProject}
          />
        )}
    </>
  );
}
