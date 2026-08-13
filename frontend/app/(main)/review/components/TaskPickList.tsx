"use client";

import type { Task } from "@/app/types/index";

/**
 * A list of tasks with a checkbox each — the selection primitive both the review
 * and the daily page are built from.
 *
 * Renders no dates, no age, and no urgency of any kind. That isn't an oversight
 * to be filled in later: this is a planning surface, and the moment it starts
 * saying "3 days overdue" it becomes a productivity tool that makes you feel
 * behind rather than one that helps you decide.
 */

interface TaskPickListProps {
  tasks: Task[];
  selected: Set<string>;
  onToggle: (documentId: string) => void;
  emptyMessage?: string;
}

export default function TaskPickList({
  tasks,
  selected,
  onToggle,
  emptyMessage,
}: TaskPickListProps) {
  if (tasks.length === 0) {
    return emptyMessage ? <p className="review-empty">{emptyMessage}</p> : null;
  }

  return (
    <ul className="review-pick-list">
      {tasks.map((task) => (
        <li key={task.documentId}>
          <label>
            <input
              type="checkbox"
              className="checkbox"
              checked={selected.has(task.documentId)}
              onChange={() => onToggle(task.documentId)}
            />
            <span>{task.title}</span>
            {/* The project, only where it isn't already implied by the heading
                above the list. Context, not status. */}
            {task.project?.title && (
              <span className="review-pick-project">{task.project.title}</span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}
