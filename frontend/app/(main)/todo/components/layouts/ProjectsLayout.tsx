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
          {/* `group-section` stays as a name: a browser spec addresses a group by it. */}
          <div className={`group-section text-left ${i > 0 ? "mt-40" : ""}`}>
            {group.name && (
              /* The heading is a dashed tab, open on the left so it reads as
                 hanging off the page's edge — closed once the page stops
                 growing at 1600px. */
              <h2 className="-ml-4 mt-0 mb-8 inline-block rounded-r-2xl border-y border-r border-dashed border-base-content bg-base-300 py-4 pr-16 pl-2 text-left min-[1601px]:border-l min-[1601px]:pl-4">
                {group.name}
              </h2>
            )}
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
