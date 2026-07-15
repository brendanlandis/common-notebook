"use client";

import { Fragment } from "react";
import TaskSections from "../TaskSections";
import type { LayoutRendererProps } from "./types";

// Renders a `projects` view: each section is a labeled group of per-project (or,
// for the stuff view, projectType/wishlist) columns already ordered by the
// engine. Single-section views carry no `name`, so no heading renders; multi-
// section views (good morning) render one heading per group with a divider
// between. Absorbs the old World/GoodMorning/Stuff/Chores/Default layouts.
export default function ProjectsLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  onEditProject,
}: LayoutRendererProps) {
  const groups = (transformedData.projectGroups ?? []).filter(
    (g) => g.columns.length > 0 || g.incidentals.length > 0
  );

  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((group, i) => (
        <Fragment key={group.name ?? i}>
          {i > 0 && <hr />}
          <div className="group-section">
            {group.name && <h2>{group.name}</h2>}
            <TaskSections
              sections={group.columns}
              incidentals={group.incidentals.length > 0 ? group.incidentals : undefined}
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onWorkSession={onWorkSession}
              onRemoveWorkSession={onRemoveWorkSession}
              onSkipRecurring={onSkipRecurring}
              onEditProject={onEditProject}
            />
          </div>
        </Fragment>
      ))}
    </>
  );
}
