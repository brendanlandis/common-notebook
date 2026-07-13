"use client";

import { useMemo } from "react";
import LayoutRenderer from "./components/LayoutRenderer";
import RecentStats from "./components/RecentStats";
import {
  transformLayout,
  type RawTaskData,
} from "@/app/lib/layoutTransformers";
import { getPresetById, getDefaultPreset } from "@/app/lib/layoutPresets";
import { useLayoutRuleset } from "@/app/contexts/LayoutRulesetContext";
import FaviconManager from "@/app/components/FaviconManager";
import { useTaskData } from "./contexts/TaskDataContext";

export default function TaskPage() {
  const {
    grouped,
    loading,
    error,
    completedTasks,
    upcomingTasks,
    longTasksWithSessions,
    recentStats,
    statsLoading,
    recentStats30Days,
    statsLoading30Days,
    onComplete,
    onEdit,
    onDelete,
    onWorkSession,
    onRemoveWorkSession,
    onSkipRecurring,
    onEditProject,
  } = useTaskData();
  const { selectedRulesetId } = useLayoutRuleset();

  // Transform layout using selected ruleset
  const transformedData = useMemo(() => {
    const ruleset = getPresetById(selectedRulesetId) || getDefaultPreset();
    const useUnfilteredRecurring = selectedRulesetId === "recurring";
    const rawData: RawTaskData = {
      projects: grouped.projects,
      categoryGroups: grouped.categoryGroups,
      incidentals: grouped.incidentals,
      recurringProjects: useUnfilteredRecurring
        ? grouped.allRecurringProjects
        : grouped.recurringProjects,
      recurringCategoryGroups: useUnfilteredRecurring
        ? grouped.allRecurringCategoryGroups
        : grouped.recurringCategoryGroups,
      recurringIncidentals: useUnfilteredRecurring
        ? grouped.allRecurringIncidentals
        : grouped.recurringIncidentals,
      completedTasks:
        selectedRulesetId === "done" || selectedRulesetId === "invoicing"
          ? completedTasks
          : undefined,
      upcomingTasks: selectedRulesetId === "done" ? upcomingTasks : undefined,
      longTasksWithSessions:
        selectedRulesetId === "done" || selectedRulesetId === "invoicing"
          ? longTasksWithSessions
          : undefined,
    };
    return transformLayout(rawData, ruleset);
  }, [
    selectedRulesetId,
    grouped,
    completedTasks,
    upcomingTasks,
    longTasksWithSessions,
  ]);

  const ruleset = getPresetById(selectedRulesetId) || getDefaultPreset();
  const layoutClass = `layout-${selectedRulesetId}`;

  if (loading) {
    return (
      <div id="container-task" className={layoutClass} suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="container-task" className={layoutClass} suppressHydrationWarning>
        <p>error: {error}</p>
      </div>
    );
  }

  const hasAnyTasks =
    grouped.projects.length > 0 ||
    grouped.categoryGroups.length > 0 ||
    grouped.incidentals.length > 0;
  const hasRecurringTasks =
    grouped.recurringProjects.length > 0 ||
    grouped.recurringCategoryGroups.length > 0 ||
    grouped.recurringIncidentals.length > 0;
  const hasCompletedTasks = completedTasks.length > 0;

  return (
    <>
      <FaviconManager type="broom" />
      <div id="container-task" className={layoutClass} suppressHydrationWarning>
        {!hasAnyTasks && !hasRecurringTasks && !hasCompletedTasks ? (
          <p>nothin' to do, nowhere to be</p>
        ) : (
          <LayoutRenderer
            transformedData={transformedData}
            ruleset={ruleset}
            selectedRulesetId={selectedRulesetId}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            onEditProject={onEditProject}
            recentStatsSection={
              selectedRulesetId === "done" &&
              (recentStats.length > 0 || recentStats30Days.length > 0) ? (
                <div className="task-section recent-stats-section">
                  <h3>recently</h3>
                  <div>
                    <RecentStats
                      stats={recentStats}
                      loading={statsLoading}
                      title="last 7 days"
                      noWrapper
                    />
                    <RecentStats
                      stats={recentStats30Days}
                      loading={statsLoading30Days}
                      title="last 30 days"
                      noWrapper
                    />
                  </div>
                </div>
              ) : undefined
            }
          />
        )}
      </div>
    </>
  );
}
