"use client";

import TaskSections from "../TaskSections";
import UpcomingSection from "../UpcomingSection";
import type { LayoutRendererProps } from "./types";

// Renders the `done` code preset: completed tasks grouped by day, plus the
// upcoming-days section and the recent-stats section. Was SingleSectionLayout's
// done/upcoming path.
export default function DoneLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  onEditProject,
  recentStatsSection,
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

  return (
    <TaskSections
      sections={transformedData.doneSections ?? []}
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
  );
}
