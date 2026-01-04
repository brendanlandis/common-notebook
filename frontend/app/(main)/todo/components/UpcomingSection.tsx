"use client";

import TodoItem from "./TodoItem";
import type { Todo } from "@/app/types/admin";

interface TodoGroup {
  title: string;
  todos: Todo[];
}

interface UpcomingSectionProps {
  upcomingTodosByDay?: TodoGroup[];
  onComplete: (documentId: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  skippedTodoMap: Map<string, { newTodoId: string; originalTodo: Todo }>;
}

export default function UpcomingSection({
  upcomingTodosByDay,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
}: UpcomingSectionProps) {
  if (!upcomingTodosByDay || upcomingTodosByDay.length === 0) {
    return null;
  }

  // Check if there are any todos at all
  const hasTodos = upcomingTodosByDay.some((day) => day.todos.length > 0);
  if (!hasTodos) {
    return null;
  }

  return (
    <div className="todo-section upcoming-section">
      <h3>upcoming</h3>
      <div className="upcoming-days">
        {upcomingTodosByDay.map((dayGroup) => {
          if (dayGroup.todos.length === 0) {
            return null;
          }

          return (
            <div key={dayGroup.title} className="upcoming-day">
              <h4>{dayGroup.title}</h4>
              <ul className="todos-list">
                {dayGroup.todos.map((todo) => (
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
                    showProjectName={true}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

