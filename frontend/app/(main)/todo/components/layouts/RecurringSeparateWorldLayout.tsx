"use client";

import TaskSections from "../TaskSections";
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
  onEditProject,
}: LayoutRendererProps) {
  return (
    <>
      {transformedData.recurringSections &&
        transformedData.recurringSections.length > 0 && (
          <TaskSections
            sections={transformedData.recurringSections}
            incidentals={transformedData.recurringIncidentals}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
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
          onEditProject={onEditProject}
        />
      )}
    </>
  );
}
