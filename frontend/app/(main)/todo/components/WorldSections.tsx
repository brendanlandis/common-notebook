"use client";

import Link from "next/link";
import TaskSections from "./TaskSections";
import type { Project, Task, World } from "@/app/types/index";

interface TaskGroup {
  title: string;
  tasks: Task[];
}

type Section = Project | TaskGroup;

interface WorldSectionsProps {
  // Keyed by world documentId, in the user's position order (the engine seeds it
  // that way); each entry carries its World object for heading/link rendering.
  worldSections: Map<string, {
    world: World;
    topOfMindAndCategories: Section[];
    priority: Section[];
    normal: Section[];
    later: Section[];
    incidentals: Task[];
  }>;
  onComplete: (documentId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  onEditProject?: (project: Project) => void;
  hideWorldName?: boolean;
}

export default function WorldSections({
  worldSections,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  onEditProject,
  hideWorldName = false,
}: WorldSectionsProps) {
  const worldsWithContent = Array.from(worldSections.values()).filter(
    (data) =>
      data.topOfMindAndCategories.length > 0 ||
      data.priority.length > 0 ||
      data.normal.length > 0 ||
      data.later.length > 0 ||
      (data.incidentals && data.incidentals.length > 0)
  );

  if (worldsWithContent.length === 0) {
    return null;
  }

  return (
    <>
      {worldsWithContent.map((data) => {
        const world = data.world;

        const hasTopOfMindOrCategories = data.topOfMindAndCategories.length > 0;
        const hasPriority = data.priority.length > 0;
        const hasNormal = data.normal.length > 0;
        const hasLater = data.later.length > 0;
        const hasIncidentals = data.incidentals.length > 0;
        const hasFirstSection = hasTopOfMindOrCategories || hasIncidentals;

        return (
          <div className="group-section" key={world.documentId}>
            {!hideWorldName && (
              <h2>
                <Link href={`/todo/world/${encodeURIComponent(world.slug)}`}>
                  {world.title}
                </Link>
              </h2>
            )}

            {/* Top of mind projects and categories */}
            {hasFirstSection && (
              <TaskSections
                sections={data.topOfMindAndCategories}
                incidentals={hasIncidentals ? data.incidentals : undefined}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onWorkSession={onWorkSession}
                onRemoveWorkSession={onRemoveWorkSession}
                onSkipRecurring={onSkipRecurring}
                onEditProject={onEditProject}
              />
            )}

            {/* Divider before the main container if top-of-mind/incidentals precede it */}
            {hasFirstSection && (hasPriority || hasNormal) && <hr />}

            {/* Priority (p1, p2, …) then normal projects — one shared tasks-container */}
            {(hasPriority || hasNormal) && (
              <TaskSections
                sections={[...data.priority, ...data.normal]}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onWorkSession={onWorkSession}
                onRemoveWorkSession={onRemoveWorkSession}
                onSkipRecurring={onSkipRecurring}
                onEditProject={onEditProject}
              />
            )}

            {/* Divider before later if any previous section exists */}
            {(hasFirstSection || hasPriority || hasNormal) && hasLater && <hr />}

            {/* Later projects */}
            {hasLater && (
              <TaskSections
                sections={data.later}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onWorkSession={onWorkSession}
                onRemoveWorkSession={onRemoveWorkSession}
                onSkipRecurring={onSkipRecurring}
                onEditProject={onEditProject}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
