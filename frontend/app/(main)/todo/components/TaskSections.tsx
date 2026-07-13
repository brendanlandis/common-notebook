"use client";

import Link from "next/link";
import TaskItem from "./TaskItem";
import type { Project, Task } from "@/app/types/index";
import { PencilIcon } from "@phosphor-icons/react";

interface TaskGroup {
  title: string;
  tasks: Task[];
}

type Section = Project | TaskGroup;

interface TaskSectionsProps {
  sections: Section[];
  incidentals?: Task[];
  onComplete: (documentId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  showProjectName?: boolean;
  onEditProject?: (project: Project) => void;
  upcomingSection?: React.ReactNode;
  recentStatsSection?: React.ReactNode;
}

export default function TaskSections({
  sections,
  incidentals,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  showProjectName = false,
  onEditProject,
  upcomingSection,
  recentStatsSection,
}: TaskSectionsProps) {
  if (sections.length === 0 && (!incidentals || incidentals.length === 0)) {
    return null;
  }

  return (
    <div className="tasks-container">
      {upcomingSection}
      {recentStatsSection}
      {sections.map((section) => {
        let tasks: Task[];
        if ("documentId" in section) {
          // It's a Project
          tasks = section.tasks || [];
        } else {
          // It's a TaskGroup
          tasks = section.tasks;
        }
        const title = section.title;
        const key = "documentId" in section ? section.documentId : title;

        if (tasks.length === 0) {
          return null;
        }

        return (
          <div key={key} className="task-section">
            {title !== "all tasks" && (
              <h3>
                {"documentId" in section ? (
                  <Link href={`/todo/project/${section.slug || section.documentId}`}>
                    {title}
                  </Link>
                ) : (
                  title
                )}
                {"documentId" in section && onEditProject && (
                  <button onClick={() => onEditProject(section as Project)}>
                    <PencilIcon size={18} />
                  </button>
                )}
              </h3>
            )}
            <ul className="tasks-list">
              {tasks.map((task) => (
                <TaskItem
                  key={task.documentId}
                  task={task}
                  onComplete={onComplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onWorkSession={onWorkSession}
                  onRemoveWorkSession={onRemoveWorkSession}
                  onSkipRecurring={onSkipRecurring}
                  showProjectName={showProjectName}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {incidentals && incidentals.length > 0 && (
        <div className="task-section">
          <h3>incidentals</h3>
          <ul className="tasks-list">
            {incidentals.map((task) => (
              <TaskItem
                key={task.documentId}
                task={task}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onWorkSession={onWorkSession}
                onRemoveWorkSession={onRemoveWorkSession}
                onSkipRecurring={onSkipRecurring}
                showProjectName={showProjectName}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

