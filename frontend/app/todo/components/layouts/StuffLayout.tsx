"use client";

import TodoSections from "../TodoSections";
import type { LayoutRendererProps } from "./types";

export default function StuffLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
  onEditProject,
}: LayoutRendererProps) {
  if (!transformedData.allSections || transformedData.allSections.length === 0) {
    return null;
  }

  const sections = transformedData.allSections;
  const regularCategories = ["buy stuff", "in the mail", "errands"];
  
  // Find the index where wishlist categories start
  let wishlistStartIndex = sections.findIndex(
    (section) => !regularCategories.includes(section.title)
  );
  
  // If no regular categories found, wishlist starts at 0
  if (wishlistStartIndex === -1) {
    wishlistStartIndex = 0;
  }

  const regularSections = sections.slice(0, wishlistStartIndex);
  const wishlistSections = sections.slice(wishlistStartIndex);

  return (
    <>
      {regularSections.length > 0 && (
        <TodoSections
          sections={regularSections}
          incidentals={transformedData.incidentals}
          onComplete={onComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          onWorkSession={onWorkSession}
          onRemoveWorkSession={onRemoveWorkSession}
          onSkipRecurring={onSkipRecurring}
          skippedTodoMap={skippedTodoMap}
          onEditProject={onEditProject}
        />
      )}
      
      {regularSections.length > 0 && wishlistSections.length > 0 && <hr />}
      
      {wishlistSections.length > 0 && (
        <TodoSections
          sections={wishlistSections}
          onComplete={onComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          onWorkSession={onWorkSession}
          onRemoveWorkSession={onRemoveWorkSession}
          onSkipRecurring={onSkipRecurring}
          skippedTodoMap={skippedTodoMap}
          onEditProject={onEditProject}
        />
      )}
    </>
  );
}

