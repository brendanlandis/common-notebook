"use client";

import TodoItemRecurringReview from "../TodoItemRecurringReview";
import type { LayoutRendererProps } from "./types";
import type { RecurrenceType, Project } from "@/app/types/index";

// Helper function to get human-readable label for recurrence type
function getRecurrenceTypeLabel(recurrenceType: RecurrenceType | "monthly"): string {
  switch (recurrenceType) {
    case "daily":
      return "every day";
    case "every x days":
      return "every x days";
    case "weekly":
      return "weekly";
    case "biweekly":
      return "biweekly";
    case "monthly":
      return "monthly";
    case "monthly date":
      return "monthly (by date)";
    case "monthly day":
      return "monthly (by day)";
    case "annually":
      return "annually";
    case "full moon":
      return "full moon";
    case "new moon":
      return "new moon";
    case "every season":
      return "every season";
    case "winter solstice":
      return "winter solstice";
    case "spring equinox":
      return "spring equinox";
    case "summer solstice":
      return "summer solstice";
    case "autumn equinox":
      return "autumn equinox";
    default:
      return recurrenceType;
  }
}

export default function RecurringReviewLayout({
  transformedData,
  onEdit,
  onDelete,
}: LayoutRendererProps) {
  const { recurringReviewSections, recurringReviewIncidentals } = transformedData;

  // Check if there are any recurring tasks at all (either in sections or incidentals)
  const hasSections = recurringReviewSections && recurringReviewSections.size > 0;
  const hasIncidentals = recurringReviewIncidentals && recurringReviewIncidentals.size > 0;
  
  if (!hasSections && !hasIncidentals) {
    return <p>no recurring tasks</p>;
  }

  // Define the order of recurrence types (with "monthly" instead of separate entries)
  const recurrenceTypeOrder: (RecurrenceType | "monthly")[] = [
    "daily",
    "every x days",
    "weekly",
    "biweekly",
    "monthly",
    "annually",
    "full moon",
    "new moon",
    "every season",
    "winter solstice",
    "spring equinox",
    "summer solstice",
    "autumn equinox",
  ];

  return (
    <div className="todos-container">
      {recurrenceTypeOrder.map((recurrenceType) => {
        const sections = recurringReviewSections?.get(recurrenceType);
        const incidentals = recurringReviewIncidentals?.get(recurrenceType);

        if (!sections && (!incidentals || incidentals.length === 0)) {
          return null;
        }

        const label = getRecurrenceTypeLabel(recurrenceType);

        return (
          <div key={recurrenceType} className="todo-section">
            <h3>{label}</h3>
            
            {/* Render projects and categories */}
            {sections && sections.map((section, index) => {
              const isProject = "documentId" in section;
              const sectionTitle = isProject ? (section as Project).title : section.title;
              const todos = isProject ? (section as Project).todos || [] : section.todos;
              
              return (
                <div key={isProject ? (section as Project).documentId : index}>
                  <h4>{sectionTitle}</h4>
                  <ul className="todos-list">
                    {todos.map((todo) => (
                      <TodoItemRecurringReview
                        key={todo.documentId}
                        todo={todo}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
            
            {/* Render incidentals */}
            {incidentals && incidentals.length > 0 && (
              <div>
                <h4>incidentals</h4>
                <ul className="todos-list">
                  {incidentals.map((todo) => (
                    <TodoItemRecurringReview
                      key={todo.documentId}
                      todo={todo}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
