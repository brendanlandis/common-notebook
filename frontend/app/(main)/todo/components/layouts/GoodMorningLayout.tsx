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
  onEditProject,
}: LayoutRendererProps) {
  return (
    <>
      {(transformedData.topOfMindSections && transformedData.topOfMindSections.length > 0) ||
      (transformedData.topOfMindIncidentals && transformedData.topOfMindIncidentals.length > 0) ? (
        <div className="group-section">
          <h2>top of mind</h2>
          <TodoSections
            sections={transformedData.topOfMindSections || []}
            incidentals={transformedData.topOfMindIncidentals}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            onEditProject={onEditProject}
          />
        </div>
      ) : null}

      {((transformedData.topOfMindSections && transformedData.topOfMindSections.length > 0) ||
        (transformedData.topOfMindIncidentals && transformedData.topOfMindIncidentals.length > 0)) &&
      ((transformedData.combinedSections && transformedData.combinedSections.length > 0) ||
        (transformedData.combinedIncidentals && transformedData.combinedIncidentals.length > 0)) && <hr />}

      {(transformedData.combinedSections && transformedData.combinedSections.length > 0) ||
      (transformedData.combinedIncidentals && transformedData.combinedIncidentals.length > 0) ? (
        <div className="group-section">
          <h2>recurring</h2>
          <TodoSections
            sections={transformedData.combinedSections || []}
            incidentals={transformedData.combinedIncidentals}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            onEditProject={onEditProject}
          />
        </div>
      ) : null}
    </>
  );
}
