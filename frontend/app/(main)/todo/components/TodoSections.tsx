"use client";

import TodoItem from "./TodoItem";
import type { Project, Todo } from "@/app/types/admin";
import { PencilIcon } from "@phosphor-icons/react";

interface TodoGroup {
  title: string;
  todos: Todo[];
}

type Section = Project | TodoGroup;

interface TodoSectionsProps {
  sections: Section[];
  incidentals?: Todo[];
  onComplete: (documentId: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  skippedTodoMap: Map<string, { newTodoId: string; originalTodo: Todo }>;
  showProjectName?: boolean;
  onEditProject?: (project: Project) => void;
  upcomingSection?: React.ReactNode;
  recentStatsSection?: React.ReactNode;
}

export default function TodoSections({
  sections,
  incidentals,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
  showProjectName = false,
  onEditProject,
  upcomingSection,
  recentStatsSection,
}: TodoSectionsProps) {
  if (sections.length === 0 && (!incidentals || incidentals.length === 0)) {
    return null;
  }

  return (
    <div className="todos-container">
      {upcomingSection}
      {recentStatsSection}
      {sections.map((section) => {
        let todos: Todo[];
        if ("documentId" in section) {
          // It's a Project
          todos = section.todos || [];
        } else {
          // It's a TodoGroup
          todos = section.todos;
        }
        const title = section.title;
        const key = "documentId" in section ? section.documentId : title;

        if (todos.length === 0) {
          return null;
        }

        return (
          <div key={key} className="todo-section">
            {title !== "all todos" && (
              <h3>
                {title}
                {"documentId" in section && onEditProject && (
                  <button onClick={() => onEditProject(section as Project)}>
                    <PencilIcon size={18} />
                  </button>
                )}
              </h3>
            )}
            <ul className="todos-list">
              {todos.map((todo) => (
                <TodoItem
                  key={todo.documentId}
                  todo={todo}
                  onComplete={onComplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onWorkSession={onWorkSession}
                  onRemoveWorkSession={onRemoveWorkSession}
                  onSkipRecurring={onSkipRecurring}
                  isSkipped={skippedTodoMap.has(todo.documentId)}
                  showProjectName={showProjectName}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {incidentals && incidentals.length > 0 && (
        <div className="todo-section">
          <h3>incidentals</h3>
          <ul className="todos-list">
            {incidentals.map((todo) => (
              <TodoItem
                key={todo.documentId}
                todo={todo}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onWorkSession={onWorkSession}
                onRemoveWorkSession={onRemoveWorkSession}
                onSkipRecurring={onSkipRecurring}
                isSkipped={skippedTodoMap.has(todo.documentId)}
                showProjectName={showProjectName}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

