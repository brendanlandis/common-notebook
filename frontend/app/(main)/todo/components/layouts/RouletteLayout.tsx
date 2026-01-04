"use client";

import { useMemo } from "react";
import TodoItem from "../TodoItem";
import type { LayoutRendererProps } from "./types";

export default function RouletteLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
}: LayoutRendererProps) {
  const randomTodo = useMemo(() => {
    const todos = transformedData.rouletteTodos || [];
    if (todos.length === 0) {
      return null;
    }
    // Select a random todo
    const randomIndex = Math.floor(Math.random() * todos.length);
    return todos[randomIndex];
  }, [transformedData.rouletteTodos]);

  if (!randomTodo) {
    return <p>No todos available</p>;
  }

  return (
    <div className="todos-container">
      <div className="todo-section">
        <ul className="todos-list">
          <TodoItem
            key={randomTodo.documentId}
            todo={randomTodo}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            isSkipped={skippedTodoMap.has(randomTodo.documentId)}
            showProjectName={true}
          />
        </ul>
      </div>
    </div>
  );
}
