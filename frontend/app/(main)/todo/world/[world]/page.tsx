"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import type { LayoutRuleset, World } from "@/app/types/index";
import { transformLayout } from "@/app/lib/layoutTransformers";
import { isValidWorld } from "@/app/lib/worlds";
import LayoutRenderer from "../../components/LayoutRenderer";
import FaviconManager from "@/app/components/FaviconManager";
import { useTaskData } from "../../contexts/TaskDataContext";
import { buildRawTaskData } from "../../utils/buildRawTaskData";

export default function WorldPage() {
  const params = useParams<{ world: string }>();
  const world = decodeURIComponent(params.world) as World;
  const worldIsValid = isValidWorld(world);

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

  // Single-world ruleset: the engine already knows how to render one world
  // (top-of-mind → priority → normal → later). visibleWorlds.length === 1
  // makes LayoutRenderer hide the redundant per-world heading.
  const ruleset: LayoutRuleset = useMemo(
    () => ({
      id: "world-view",
      name: world,
      showRecurring: true,
      showNonRecurring: true,
      visibleWorlds: [world],
      visibleCategories: null,
      sortBy: "creationDate",
      groupBy: "world",
    }),
    [world]
  );

  const transformedData = useMemo(
    () => transformLayout(buildRawTaskData(grouped), ruleset),
    [grouped, ruleset]
  );

  if (!worldIsValid) {
    notFound();
  }

  if (loading) {
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

  const hasTasks =
    !!transformedData.worldSections && transformedData.worldSections.size > 0;

  return (
    <>
      <FaviconManager type="broom" />
      <div id="container-task" className="layout-world-view" suppressHydrationWarning>
        <h1 className="world-title">{world}</h1>
        {hasTasks ? (
          <LayoutRenderer
            transformedData={transformedData}
            ruleset={ruleset}
            selectedRulesetId={ruleset.id}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
            onEditProject={onEditProject}
          />
        ) : (
          <p>nothin' to do in {world}</p>
        )}
      </div>
    </>
  );
}
