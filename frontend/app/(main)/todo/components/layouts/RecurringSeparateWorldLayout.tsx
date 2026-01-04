"use client";

import TodoSections from "../TodoSections";
import WorldSections from "../WorldSections";
import type { LayoutRendererProps } from "./types";

export default function RecurringSeparateWorldLayout({
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

      {transformedData.recurringSections &&
        transformedData.recurringSections.length > 0 &&
        transformedData.worldSections && <hr />}

      {transformedData.worldSections && (
        <WorldSections
          worldSections={transformedData.worldSections}
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
