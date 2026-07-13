"use client";

import TaskSections from "../TaskSections";
import type { LayoutRendererProps } from "./types";

export default function ChoresLayout({
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
    (transformedData.nonRecurringNoProjectSections && transformedData.nonRecurringNoProjectSections.length > 0) ||
    (transformedData.nonRecurringNoProjectIncidentals && transformedData.nonRecurringNoProjectIncidentals.length > 0) ? (
      <TaskSections
        sections={transformedData.nonRecurringNoProjectSections || []}
        incidentals={transformedData.nonRecurringNoProjectIncidentals}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        onWorkSession={onWorkSession}
        onRemoveWorkSession={onRemoveWorkSession}
        onSkipRecurring={onSkipRecurring}
        onEditProject={onEditProject}
      />
    ) : null
  );
}


