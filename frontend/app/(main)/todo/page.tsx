"use client";

import { useMemo } from "react";
import LayoutRenderer from "./components/LayoutRenderer";
import RecentStats from "./components/RecentStats";
import {
  transformLayout,
  type RawTaskData,
} from "@/app/lib/layoutTransformers";
import { viewToRuleset, findViewBySlug, findCodePreset } from "@/app/lib/views";
import type { LayoutRuleset } from "@/app/types/index";
import { useLayoutRuleset } from "@/app/contexts/LayoutRulesetContext";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useWorlds } from "@/app/contexts/WorldsContext";
import { useViews } from "@/app/contexts/ViewsContext";
import FaviconManager from "@/app/components/FaviconManager";
import { useTaskData } from "./contexts/TaskDataContext";

const DEFAULT_VIEW_SLUG = "good-morning";
const EMPTY_RULESET: LayoutRuleset = { slug: "", name: "", layout: "projects", sections: [] };

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
  const { stuffProjectsEnabled } = useStuffProjects();
  const { worlds } = useWorlds();
  const { views } = useViews();

  // Resolve the selected id to a runtime ruleset: a code preset (done/recurring),
  // a composable data view, or the default view — falling off the stuff view when
  // stuff projects are disabled (a stale ?view=stuff URL / localStorage value).
  const ruleset: LayoutRuleset = useMemo(() => {
    const codePreset = findCodePreset(selectedRulesetId);
    if (codePreset) return codePreset;
    let view = findViewBySlug(selectedRulesetId, views);
    if (view?.systemKey === "stuff" && !stuffProjectsEnabled) view = undefined;
    view = view ?? findViewBySlug(DEFAULT_VIEW_SLUG, views);
    return view ? viewToRuleset(view) : EMPTY_RULESET;
  }, [selectedRulesetId, views, stuffProjectsEnabled]);

  const isDone = ruleset.codePreset === "done";
  const isRecurring = ruleset.codePreset === "recurring";
  const effectiveSlug = ruleset.slug || selectedRulesetId;

  // Transform layout using the resolved ruleset.
  const transformedData = useMemo(() => {
    const rawData: RawTaskData = {
      projects: grouped.projects,
      categoryGroups: grouped.categoryGroups,
      incidentals: grouped.incidentals,
      // The recurring review shows every recurring task regardless of displayDate.
      recurringProjects: isRecurring ? grouped.allRecurringProjects : grouped.recurringProjects,
      recurringCategoryGroups: isRecurring
        ? grouped.allRecurringCategoryGroups
        : grouped.recurringCategoryGroups,
      recurringIncidentals: isRecurring ? grouped.allRecurringIncidentals : grouped.recurringIncidentals,
      completedTasks: isDone ? completedTasks : undefined,
      upcomingTasks: isDone ? upcomingTasks : undefined,
      longTasksWithSessions: isDone ? longTasksWithSessions : undefined,
    };
    return transformLayout(rawData, ruleset, worlds);
  }, [ruleset, isDone, isRecurring, grouped, completedTasks, upcomingTasks, longTasksWithSessions, worlds]);

  const layoutClass = `layout-${effectiveSlug}`;

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
            selectedRulesetId={effectiveSlug}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            onEditProject={onEditProject}
            recentStatsSection={
              isDone &&
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
