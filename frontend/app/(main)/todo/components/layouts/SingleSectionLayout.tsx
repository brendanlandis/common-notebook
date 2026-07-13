"use client";

import { useMemo } from "react";
import TaskSections from "../TaskSections";
import UpcomingSection from "../UpcomingSection";
import TaskItem from "../TaskItem";
import type { LayoutRendererProps } from "./types";
import type { Task } from "@/app/types/index";
import { format, parseISO } from "date-fns";

export default function SingleSectionLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  onEditProject,
  recentStatsSection,
  selectedRulesetId,
}: LayoutRendererProps) {
  const upcomingSection = transformedData.upcomingTasksByDay && (
    <UpcomingSection
      upcomingTasksByDay={transformedData.upcomingTasksByDay}
      onComplete={onComplete}
      onEdit={onEdit}
      onDelete={onDelete}
      onWorkSession={onWorkSession}
      onRemoveWorkSession={onRemoveWorkSession}
      onSkipRecurring={onSkipRecurring}
    />
  );

  // Group tasks by month for the "everything" view
  const groupedByMonth = useMemo(() => {
    if (
      selectedRulesetId !== "everything" &&
      selectedRulesetId !== "chipping-away" &&
      selectedRulesetId !== "data-chores"
    ) {
      return null;
    }

    // Collect all tasks from all sections
    const allTasks: Task[] = [];
    if (transformedData.allSections) {
      transformedData.allSections.forEach((section) => {
        let tasks: Task[];
        if ("documentId" in section) {
          // It's a Project
          tasks = section.tasks || [];
        } else {
          // It's a TaskGroup
          tasks = section.tasks;
        }
        allTasks.push(...tasks);
      });
    }

    // Add incidentals to the pool of tasks to be grouped
    if (transformedData.incidentals) {
      allTasks.push(...transformedData.incidentals);
    }

    // Group tasks by creation month
    const tasksByMonth = new Map<string, { date: Date; tasks: Task[] }>();

    allTasks.forEach((task) => {
      try {
        const createdDate = parseISO(task.createdAt);
        // Format as "YYYY-MM" for grouping, but keep the date for sorting
        const monthKey = format(createdDate, "yyyy-MM");

        if (!tasksByMonth.has(monthKey)) {
          tasksByMonth.set(monthKey, { date: createdDate, tasks: [] });
        }
        tasksByMonth.get(monthKey)!.tasks.push(task);
      } catch (error) {
        console.error("Error parsing date for task:", task.documentId, error);
      }
    });

    // Convert map to array and sort by date (oldest first)
    const sortedMonths = Array.from(tasksByMonth.entries()).sort(
      ([, a], [, b]) => a.date.getTime() - b.date.getTime(),
    );

    // Create month groups with sorted tasks
    return sortedMonths.map(([monthKey, { date, tasks }]) => ({
      title: format(date, "MMMM yyyy"),
      // Sort tasks within each month by creation date (oldest first)
      tasks: tasks.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      }),
    }));
  }, [
    transformedData.allSections,
    transformedData.incidentals,
    selectedRulesetId,
  ]);

  // Render custom layout for "everything" view
  if (
    (selectedRulesetId === "everything" ||
      selectedRulesetId === "chipping-away" ||
      selectedRulesetId === "data-chores") &&
    groupedByMonth &&
    groupedByMonth.length > 0
  ) {
    return (
      <div className="tasks-container">
        {upcomingSection}
        {recentStatsSection}
        <div className="task-section">
          {groupedByMonth.map((monthGroup) => (
            <div key={monthGroup.title}>
              <h4>{monthGroup.title}</h4>
              <ul className="tasks-list">
                {monthGroup.tasks.map((task) => (
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
          ))}
        </div>
      </div>
    );
  }

  // Default rendering for other views
  return (
    transformedData.allSections &&
    transformedData.allSections.length > 0 && (
      <TaskSections
        sections={transformedData.allSections}
        incidentals={transformedData.incidentals}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        onWorkSession={onWorkSession}
        onRemoveWorkSession={onRemoveWorkSession}
        onSkipRecurring={onSkipRecurring}
        showProjectName={true}
        onEditProject={onEditProject}
        upcomingSection={upcomingSection}
        recentStatsSection={recentStatsSection}
      />
    )
  );
}
