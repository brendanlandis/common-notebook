"use client";

import TodoSections from "../TodoSections";
import type { LayoutRendererProps } from "./types";

export default function GoodMorningLayout({
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
      {(transformedData.combinedSections && transformedData.combinedSections.length > 0) ||
      (transformedData.combinedIncidentals && transformedData.combinedIncidentals.length > 0) ? (
        <TodoSections
          sections={transformedData.combinedSections || []}
          incidentals={transformedData.combinedIncidentals}
          onComplete={onComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          onWorkSession={onWorkSession}
          onRemoveWorkSession={onRemoveWorkSession}
          onSkipRecurring={onSkipRecurring}
          skippedTodoMap={skippedTodoMap}
          onEditProject={onEditProject}
        />
      ) : null}

      {((transformedData.combinedSections && transformedData.combinedSections.length > 0) ||
        (transformedData.combinedIncidentals && transformedData.combinedIncidentals.length > 0)) &&
      ((transformedData.topOfMindSections && transformedData.topOfMindSections.length > 0) ||
        (transformedData.topOfMindIncidentals && transformedData.topOfMindIncidentals.length > 0)) && <hr />}

      {(transformedData.topOfMindSections && transformedData.topOfMindSections.length > 0) ||
      (transformedData.topOfMindIncidentals && transformedData.topOfMindIncidentals.length > 0) ? (
        <TodoSections
          sections={transformedData.topOfMindSections || []}
          incidentals={transformedData.topOfMindIncidentals}
          onComplete={onComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          onWorkSession={onWorkSession}
          onRemoveWorkSession={onRemoveWorkSession}
          onSkipRecurring={onSkipRecurring}
          skippedTodoMap={skippedTodoMap}
          onEditProject={onEditProject}
        />
      ) : null}
    </>
  );
}
