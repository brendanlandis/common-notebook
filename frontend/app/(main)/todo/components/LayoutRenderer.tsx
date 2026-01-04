"use client";

import type { LayoutRuleset } from "@/app/types/layoutRuleset";
import type { TransformedLayout } from "@/app/lib/layoutTransformers";
import type { Todo, Project } from "@/app/types/admin";
import RecurringSeparateLayout from "./layouts/RecurringSeparateLayout";
import RecurringSeparateWorldLayout from "./layouts/RecurringSeparateWorldLayout";
import WorldLayout from "./layouts/WorldLayout";
import GoodMorningLayout from "./layouts/GoodMorningLayout";
import SingleSectionLayout from "./layouts/SingleSectionLayout";
import DefaultLayout from "./layouts/DefaultLayout";
import RouletteLayout from "./layouts/RouletteLayout";
import StuffLayout from "./layouts/StuffLayout";
import ChoresLayout from "./layouts/ChoresLayout";
import type { LayoutRendererProps } from "./layouts/types";

interface LayoutRendererComponentProps {
  transformedData: TransformedLayout;
  ruleset: LayoutRuleset;
  selectedRulesetId: string;
  onComplete: (documentId: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  skippedTodoMap: Map<string, { newTodoId: string; originalTodo: Todo }>;
  onEditProject?: (project: Project) => void;
  recentStatsSection?: React.ReactNode;
}

const LAYOUT_COMPONENTS: Record<string, React.ComponentType<LayoutRendererProps>> = {
  "recurring-separate": RecurringSeparateLayout,
  "recurring-separate-world": RecurringSeparateWorldLayout,
  "world": WorldLayout,
  "good-morning": GoodMorningLayout,
  "single-section": SingleSectionLayout,
  "merged": DefaultLayout,
  "project": DefaultLayout,
  "category": DefaultLayout,
  "roulette": RouletteLayout,
  "stuff": StuffLayout,
  "later": DefaultLayout,
  "chores": ChoresLayout,
  "done": SingleSectionLayout,
};

export default function LayoutRenderer({
  transformedData,
  ruleset,
  selectedRulesetId,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
  onEditProject,
  recentStatsSection,
}: LayoutRendererComponentProps) {
  // Use StuffLayout for "stuff" view (which uses category groupBy)
  const LayoutComponent = ruleset.id === "stuff" 
    ? StuffLayout 
    : LAYOUT_COMPONENTS[ruleset.groupBy] || DefaultLayout;

  return (
    <LayoutComponent
      transformedData={transformedData}
      selectedRulesetId={selectedRulesetId}
      onComplete={onComplete}
      onEdit={onEdit}
      onDelete={onDelete}
      onWorkSession={onWorkSession}
      onRemoveWorkSession={onRemoveWorkSession}
      onSkipRecurring={onSkipRecurring}
      skippedTodoMap={skippedTodoMap}
      onEditProject={onEditProject}
      recentStatsSection={recentStatsSection}
    />
  );
}
