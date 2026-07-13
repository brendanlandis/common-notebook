"use client";

import TaskSections from "../TaskSections";
import type { LayoutRendererProps } from "./types";

export default function DefaultLayout({
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
    transformedData.allSections &&
    transformedData.allSections.length > 0 && (
      <TaskSections
        sections={transformedData.allSections}
        incidentals={transformedData.incidentals}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        onWorkSession={onWorkSession}
        onRemoveWorkSession={onRemoveWorkSession}
        onSkipRecurring={onSkipRecurring}
        onEditProject={onEditProject}
      />
    )
  );
}
