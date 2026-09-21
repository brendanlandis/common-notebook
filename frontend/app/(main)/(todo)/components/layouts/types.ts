import type { Task, Project } from "@/app/types/index";
import type { TransformedLayout } from "@/app/lib/layoutTransformers";

export interface LayoutRendererProps {
  transformedData: TransformedLayout;
  onComplete: (documentId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  onEditProject?: (project: Project) => void;
  selectedRulesetId?: string; // For layout-specific tweaks (e.g. month grouping)
  recentStatsSection?: React.ReactNode;
}
