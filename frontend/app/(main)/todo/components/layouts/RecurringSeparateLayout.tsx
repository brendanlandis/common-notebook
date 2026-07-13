"use client";

import TaskSections from "../TaskSections";
import type { LayoutRendererProps } from "./types";

export default function RecurringSeparateLayout({
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

      {transformedData.nonRecurringSections &&
        transformedData.nonRecurringSections.length > 0 && (
          <TaskSections
            sections={transformedData.nonRecurringSections}
            incidentals={transformedData.nonRecurringIncidentals}
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
