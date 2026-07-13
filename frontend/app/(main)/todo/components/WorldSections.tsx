"use client";

import Link from "next/link";
import TodoSections from "./TodoSections";
import type { Project, Todo, World } from "@/app/types/index";

interface TodoGroup {
  title: string;
  todos: Todo[];
}

type Section = Project | TodoGroup;

interface WorldSectionsProps {
  worldSections: Map<World, {
    topOfMindAndCategories: Section[];
    priority: Section[];
    normal: Section[];
    later: Section[];
    incidentals: Todo[];
  }>;
  onComplete: (documentId: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  onEditProject?: (project: Project) => void;
  hideWorldName?: boolean;
}

const WORLD_ORDER: World[] = ['make music', 'music admin', 'life stuff', 'day job', 'computer'];

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
  const worlds = WORLD_ORDER.filter(world => {
    const data = worldSections.get(world);
    return data && (
      data.topOfMindAndCategories.length > 0 ||
      data.priority.length > 0 ||
      data.normal.length > 0 ||
      data.later.length > 0 ||
      (data.incidentals && data.incidentals.length > 0)
    );
  });

  if (worlds.length === 0) {
    return null;
  }

  return (
    <>
      {worlds.map((world) => {
        const data = worldSections.get(world);
        if (!data || (
          data.topOfMindAndCategories.length === 0 &&
          data.priority.length === 0 &&
          data.normal.length === 0 &&
          data.later.length === 0 &&
          (!data.incidentals || data.incidentals.length === 0)
        )) {
          return null;
        }

        const hasTopOfMindOrCategories = data.topOfMindAndCategories.length > 0;
        const hasPriority = data.priority.length > 0;
        const hasNormal = data.normal.length > 0;
        const hasLater = data.later.length > 0;
        const hasIncidentals = data.incidentals.length > 0;
        const hasFirstSection = hasTopOfMindOrCategories || hasIncidentals;

        return (
          <div className="group-section" key={world}>
            {!hideWorldName && (
              <h2>
                <Link href={`/todo/world/${encodeURIComponent(world)}`}>
                  {world}
                </Link>
              </h2>
            )}
            
            {/* Top of mind projects and categories */}
            {hasFirstSection && (
              <TodoSections
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

            {/* Priority (p1, p2, …) then normal projects — one shared todos-container */}
            {(hasPriority || hasNormal) && (
              <TodoSections
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
              <TodoSections
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

