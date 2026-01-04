"use client";

import WorldSections from "../WorldSections";
import type { LayoutRendererProps } from "./types";

const SINGLE_WORLD_LAYOUTS = ["day-job", "life-stuff", "music-admin", "make-music", "web-sites"];

export default function WorldLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
  onEditProject,
  selectedRulesetId,
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
        skippedTodoMap={skippedTodoMap}
        onEditProject={onEditProject}
        hideWorldName={SINGLE_WORLD_LAYOUTS.includes(selectedRulesetId || "")}
      />
    )
  );
}
