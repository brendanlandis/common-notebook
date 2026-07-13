"use client";

import TaskItem from "./TaskItem";
import type { Task } from "@/app/types/index";

interface TaskGroup {
  title: string;
  tasks: Task[];
}

interface UpcomingSectionProps {
  upcomingTasksByDay?: TaskGroup[];
  onComplete: (documentId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
}

export default function UpcomingSection({
  upcomingTasksByDay,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
}: UpcomingSectionProps) {
  if (!upcomingTasksByDay || upcomingTasksByDay.length === 0) {
    return null;
  }

  // Check if there are any tasks at all
  const hasTasks = upcomingTasksByDay.some((day) => day.tasks.length > 0);
  if (!hasTasks) {
    return null;
  }

  return (
    <div className="task-section upcoming-section">
      <h3>upcoming</h3>
      <div className="upcoming-days">
        {upcomingTasksByDay.map((dayGroup) => {
          if (dayGroup.tasks.length === 0) {
            return null;
          }

          return (
            <div key={dayGroup.title} className="upcoming-day">
              <h4>{dayGroup.title}</h4>
              <ul className="tasks-list">
                {dayGroup.tasks.map((task) => (
                  <TaskItem
                    key={task.documentId}
                    task={task}
                    onComplete={onComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onWorkSession={onWorkSession}
                    onRemoveWorkSession={onRemoveWorkSession}
                    onSkipRecurring={onSkipRecurring}
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

