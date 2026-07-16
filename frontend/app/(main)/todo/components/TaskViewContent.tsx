"use client";

import { useMemo } from "react";
import LayoutRenderer from "./LayoutRenderer";
import RecentStats from "./RecentStats";
import {
  transformLayout,
  type RawTaskData,
} from "@/app/lib/layoutTransformers";
import {
  viewToRuleset,
  findViewBySlug,
  findCodePreset,
  DEFAULT_VIEW_SLUG,
} from "@/app/lib/views";
import type { LayoutRuleset } from "@/app/types/index";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useWorlds } from "@/app/hooks/useWorlds";
import { useViews } from "@/app/hooks/useViews";
import FaviconManager from "@/app/components/FaviconManager";
import { useTaskData } from "../contexts/TaskDataContext";

const EMPTY_RULESET: LayoutRuleset = { slug: "", name: "", layout: "projects", sections: [] };

// Renders one task view for the given slug (a data view or a code preset). The
// /todo index feeds this the default slug; /todo/view/[view] feeds it the route
// param. All ruleset resolution + transform + render lives here so both routes
// stay identical.
export default function TaskViewContent({ slug }: { slug: string }) {
  const { timeZoneSettings } = useDateTimeSettings();
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
  const { stuffProjectsEnabled } = useStuffProjects();
  const { worlds } = useWorlds();
  const { views } = useViews();

  // Resolve the slug to a runtime ruleset: a code preset (done/recurring), a
  // composable data view, or the default view — falling off the stuff view when
  // stuff projects are disabled (a stale slug / localStorage value).
  const ruleset: LayoutRuleset = useMemo(() => {
    const codePreset = findCodePreset(slug);
    if (codePreset) return codePreset;
    let view = findViewBySlug(slug, views);
    if (view?.systemKey === "stuff" && !stuffProjectsEnabled) view = undefined;
    view = view ?? findViewBySlug(DEFAULT_VIEW_SLUG, views);
    return view ? viewToRuleset(view) : EMPTY_RULESET;
  }, [slug, views, stuffProjectsEnabled]);

  const isDone = ruleset.codePreset === "done";
  const isRecurring = ruleset.codePreset === "recurring";
  const effectiveSlug = ruleset.slug || slug;

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
    return transformLayout(rawData, ruleset, timeZoneSettings, worlds);
  }, [ruleset, isDone, isRecurring, grouped, completedTasks, upcomingTasks, longTasksWithSessions, worlds, timeZoneSettings]);

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

  // Count tasks, not projects: `grouped.projects` is every project the user has
  // now, including empty ones, so its length says nothing about having anything
  // to do. Checking it would mean the empty state never showed again.
  const hasAnyTasks =
    grouped.projects.some((p) => (p.tasks?.length ?? 0) > 0) ||
    grouped.categoryGroups.some((g) => (g.tasks?.length ?? 0) > 0) ||
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
