"use client";

import { useMemo } from "react";
import TaskItem from "../TaskItem";
import type { LayoutRendererProps } from "./types";
import type { Task } from "@/app/types/index";
import { format, parseISO } from "date-fns";

// Renders a `chronological` view: one flat list of the section's tasks (already
// oldest → newest), grouped under month headings. Absorbs the old
// SingleSectionLayout "everything"/"chipping-away" month grouping.
export default function ChronologicalLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  recentStatsSection,
}: LayoutRendererProps) {
  const tasks = transformedData.chronologicalTasks ?? [];

  const groupedByMonth = useMemo(() => {
    const byMonth = new Map<string, { date: Date; tasks: Task[] }>();
    tasks.forEach((task) => {
      try {
        const created = parseISO(task.createdAt);
        const key = format(created, "yyyy-MM");
        if (!byMonth.has(key)) byMonth.set(key, { date: created, tasks: [] });
        byMonth.get(key)!.tasks.push(task);
      } catch (error) {
        console.error("Error parsing date for task:", task.documentId, error);
      }
    });
    return Array.from(byMonth.entries()).sort(([, a], [, b]) => a.date.getTime() - b.date.getTime());
  }, [tasks]);

  if (tasks.length === 0) return null;

  return (
    <div className="tasks-container">
      {recentStatsSection}
      <div className="task-section">
        {groupedByMonth.map(([key, { date, tasks: monthTasks }]) => (
          <div key={key}>
            <h4>{format(date, "MMMM yyyy")}</h4>
            <ul className="tasks-list">
              {monthTasks.map((task) => (
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
