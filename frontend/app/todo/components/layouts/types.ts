import type { Todo, Project } from "@/app/types/admin";
import type { TransformedLayout } from "@/app/lib/layoutTransformers";

export interface LayoutRendererProps {
  transformedData: TransformedLayout;
  onComplete: (documentId: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  skippedTodoMap: Map<string, { newTodoId: string; originalTodo: Todo }>;
  onEditProject?: (project: Project) => void;
  selectedRulesetId?: string; // For layout-specific props like hideWorldName
  recentStatsSection?: React.ReactNode;
}
