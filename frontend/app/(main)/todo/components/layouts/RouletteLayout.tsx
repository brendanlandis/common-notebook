"use client";

import { useMemo } from "react";
import TaskItem from "../TaskItem";
import type { LayoutRendererProps } from "./types";

export default function RouletteLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
}: LayoutRendererProps) {
  const randomTask = useMemo(() => {
    const tasks = transformedData.rouletteTasks || [];
    if (tasks.length === 0) {
      return null;
    }
    // Select a random task
    const randomIndex = Math.floor(Math.random() * tasks.length);
    return tasks[randomIndex];
  }, [transformedData.rouletteTasks]);

  if (!randomTask) {
    return <p>No tasks available</p>;
  }

  return (
    <div className="tasks-container">
      <div className="task-section">
        <ul className="tasks-list">
          <TaskItem
            key={randomTask.documentId}
            task={randomTask}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            showProjectName={true}
          />
        </ul>
      </div>
    </div>
  );
}
