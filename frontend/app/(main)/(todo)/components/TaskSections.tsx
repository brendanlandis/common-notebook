"use client";

import Link from "next/link";
import TaskItem from "./TaskItem";
import TaskSection, { TaskGrid, TaskList } from "./TaskSection";
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
  /** h3 when the columns sit under a group's name, so they read a level below it. */
  headingLevel?: "h2" | "h3";
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
  headingLevel = "h2",
}: TaskSectionsProps) {
  // The upcoming panel and the stats chart count: on the done view they can be
  // the only things there, and bailing out on empty `sections` alone meant an
  // account with nothing completed lately saw neither.
  if (
    sections.length === 0 &&
    (!incidentals || incidentals.length === 0) &&
    !upcomingSection &&
    !recentStatsSection
  ) {
    return null;
  }

  return (
    <TaskGrid>
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
          <TaskSection
            key={key}
            headingLevel={headingLevel}
            title={
              title !== "all tasks" && (
                <>
                  {"documentId" in section ? (
                    <Link href={`/project/${section.slug || section.documentId}`}>
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                  {"documentId" in section && onEditProject && (
                    <button
                      onClick={() => onEditProject(section as Project)}
                      aria-label="edit project"
                    >
                      <PencilIcon size={18} />
                    </button>
                  )}
                </>
              )
            }
          >
            <TaskList>
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
            </TaskList>
          </TaskSection>
        );
      })}

      {incidentals && incidentals.length > 0 && (
        <TaskSection title="incidentals" headingLevel={headingLevel}>
          <TaskList>
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
          </TaskList>
        </TaskSection>
      )}
    </TaskGrid>
  );
}

