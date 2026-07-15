"use client";

import type { LayoutRuleset, Task, Project } from "@/app/types/index";
import type { TransformedLayout } from "@/app/lib/layoutTransformers";
import ProjectsLayout from "./layouts/ProjectsLayout";
import ChronologicalLayout from "./layouts/ChronologicalLayout";
import RouletteLayout from "./layouts/RouletteLayout";
import DoneLayout from "./layouts/DoneLayout";
import RecurringReviewLayout from "./layouts/RecurringReviewLayout";
import type { LayoutRendererProps } from "./layouts/types";

interface LayoutRendererComponentProps {
  transformedData: TransformedLayout;
  ruleset: LayoutRuleset;
  selectedRulesetId: string;
  onComplete: (documentId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  onEditProject?: (project: Project) => void;
  recentStatsSection?: React.ReactNode;
}

// Two code presets (done, recurring) select bespoke components; every other view
// maps by its `layout` engine.
function pickComponent(ruleset: LayoutRuleset): React.ComponentType<LayoutRendererProps> {
  if (ruleset.codePreset === "done") return DoneLayout;
  if (ruleset.codePreset === "recurring") return RecurringReviewLayout;
  if (ruleset.layout === "chronological") return ChronologicalLayout;
  if (ruleset.layout === "roulette") return RouletteLayout;
  return ProjectsLayout;
}

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
  onEditProject,
  recentStatsSection,
}: LayoutRendererComponentProps) {
  const LayoutComponent = pickComponent(ruleset);

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
      onEditProject={onEditProject}
      recentStatsSection={recentStatsSection}
    />
  );
}
