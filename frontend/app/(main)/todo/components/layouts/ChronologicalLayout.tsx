"use client";

import { useMemo } from "react";
import TaskItem from "../TaskItem";
import type { LayoutRendererProps } from "./types";
import type { Task } from "@/app/types/index";
import { formatInTimezone } from "@/app/lib/dateUtils";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";

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
  const { timeZoneSettings } = useDateTimeSettings();
  const tasks = transformedData.chronologicalTasks ?? [];

  const groupedByMonth = useMemo(() => {
    // Month key comes from the user's timezone, not the machine's: a task created
    // 2026-01-31 22:00 EST filed under February on UTC prod when this used bare
    // format(). `date` stays a real instant, used for sorting and for the heading.
    const byMonth = new Map<string, { date: Date; tasks: Task[] }>();
    tasks.forEach((task) => {
      try {
        const created = new Date(task.createdAt); // a real instant from Strapi's ISO string
        const key = formatInTimezone(created, "yyyy-MM", timeZoneSettings);
        if (!byMonth.has(key)) byMonth.set(key, { date: created, tasks: [] });
        byMonth.get(key)!.tasks.push(task);
      } catch (error) {
        console.error("Error parsing date for task:", task.documentId, error);
      }
    });
    return Array.from(byMonth.entries()).sort(([, a], [, b]) => a.date.getTime() - b.date.getTime());
  }, [tasks, timeZoneSettings]);

  if (tasks.length === 0) return null;

  return (
    <div className="tasks-container">
      {recentStatsSection}
      <div className="task-section">
        {groupedByMonth.map(([key, { date, tasks: monthTasks }]) => (
          <div key={key}>
            <h4>{formatInTimezone(date, "MMMM yyyy", timeZoneSettings)}</h4>
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
