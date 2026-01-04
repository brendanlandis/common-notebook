"use client";

import TodoSections from "./TodoSections";
import type { Project, Todo, World } from "@/app/types/admin";

interface TodoGroup {
  title: string;
  todos: Todo[];
}

type Section = Project | TodoGroup;

interface WorldSectionsProps {
  worldSections: Map<World, { 
    topOfMindAndCategories: Section[];
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
  skippedTodoMap: Map<string, { newTodoId: string; originalTodo: Todo }>;
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
  skippedTodoMap,
  onEditProject,
  hideWorldName = false,
}: WorldSectionsProps) {
  const worlds = WORLD_ORDER.filter(world => {
    const data = worldSections.get(world);
    return data && (
      data.topOfMindAndCategories.length > 0 || 
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
      {worlds.map((world, index) => {
        const data = worldSections.get(world);
        if (!data || (
          data.topOfMindAndCategories.length === 0 && 
          data.normal.length === 0 && 
          data.later.length === 0 && 
          (!data.incidentals || data.incidentals.length === 0)
        )) {
          return null;
        }

        const hasTopOfMindOrCategories = data.topOfMindAndCategories.length > 0;
        const hasNormal = data.normal.length > 0;
        const hasLater = data.later.length > 0;
        const hasIncidentals = data.incidentals.length > 0;
        const hasFirstSection = hasTopOfMindOrCategories || hasIncidentals;

        return (
          <div className="world-section" key={world}>
            {!hideWorldName && <h2>{world}</h2>}
            
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
                skippedTodoMap={skippedTodoMap}
                onEditProject={onEditProject}
              />
            )}

            {/* Divider before normal if first section exists */}
            {hasFirstSection && hasNormal && <hr />}

            {/* Normal projects */}
            {hasNormal && (
              <TodoSections
                sections={data.normal}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onWorkSession={onWorkSession}
                onRemoveWorkSession={onRemoveWorkSession}
                onSkipRecurring={onSkipRecurring}
                skippedTodoMap={skippedTodoMap}
                onEditProject={onEditProject}
              />
            )}

            {/* Divider before later if any previous section exists */}
            {(hasFirstSection || hasNormal) && hasLater && <hr />}

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
                skippedTodoMap={skippedTodoMap}
                onEditProject={onEditProject}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

