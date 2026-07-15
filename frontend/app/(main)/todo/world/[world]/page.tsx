"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import type { LayoutRuleset } from "@/app/types/index";
import { transformLayout } from "@/app/lib/layoutTransformers";
import { findWorldBySlug } from "@/app/lib/worlds";
import { useWorlds } from "@/app/contexts/WorldsContext";
import LayoutRenderer from "../../components/LayoutRenderer";
import FaviconManager from "@/app/components/FaviconManager";
import { useTaskData } from "../../contexts/TaskDataContext";
import { buildRawTaskData } from "../../utils/buildRawTaskData";

export default function WorldPage() {
  const params = useParams<{ world: string }>();
  const slug = decodeURIComponent(params.world);
  const { worlds, loading: worldsLoading } = useWorlds();
  const world = findWorldBySlug(slug, worlds);

  const {
    grouped,
    loading,
    error,
    onComplete,
    onEdit,
    onDelete,
    onWorkSession,
    onRemoveWorkSession,
    onSkipRecurring,
    onEditProject,
  } = useTaskData();

  // Single-world ruleset: a projects view scoped to just this world. The engine
  // orders its columns top-of-mind → priority → normal → later.
  const ruleset: LayoutRuleset = useMemo(
    () => ({
      slug: `world:${slug}`,
      name: world?.title ?? slug,
      layout: "projects",
      sections: [
        {
          worldMode: "only",
          worldIds: [world?.documentId ?? "__unknown__"],
          importance: "any",
          projectType: "any",
          recurrence: "both",
          longOnly: false,
        },
      ],
    }),
    [world, slug]
  );

  const transformedData = useMemo(
    () => transformLayout(buildRawTaskData(grouped), ruleset, worlds),
    [grouped, ruleset, worlds]
  );

  // Only 404 once worlds have loaded and the slug truly matches none.
  if (!worldsLoading && !world) {
    notFound();
  }

  if (loading || worldsLoading) {
    return (
      <div id="container-task" className="layout-world-view" suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="container-task" className="layout-world-view" suppressHydrationWarning>
        <p>error: {error}</p>
      </div>
    );
  }

  const hasTasks = (transformedData.projectGroups ?? []).some(
    (g) => g.columns.length > 0 || g.incidentals.length > 0
  );

  return (
    <>
      <FaviconManager type="broom" />
      <div id="container-task" className="layout-world-view" suppressHydrationWarning>
        <h1 className="world-title">{world?.title ?? slug}</h1>
        {hasTasks ? (
          <LayoutRenderer
            transformedData={transformedData}
            ruleset={ruleset}
            selectedRulesetId={ruleset.slug}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            onEditProject={onEditProject}
          />
        ) : (
          <p>nothin' to do in {world?.title ?? slug}</p>
        )}
      </div>
    </>
  );
}
