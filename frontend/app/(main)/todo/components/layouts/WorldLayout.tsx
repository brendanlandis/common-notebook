"use client";

import WorldSections from "../WorldSections";
import type { LayoutRendererProps } from "./types";

export default function WorldLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  onEditProject,
  hideWorldName,
}: LayoutRendererProps) {
  return (
    transformedData.worldSections && (
      <WorldSections
        worldSections={transformedData.worldSections}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        onWorkSession={onWorkSession}
        onRemoveWorkSession={onRemoveWorkSession}
        onSkipRecurring={onSkipRecurring}
        onEditProject={onEditProject}
        hideWorldName={hideWorldName}
      />
    )
  );
}
