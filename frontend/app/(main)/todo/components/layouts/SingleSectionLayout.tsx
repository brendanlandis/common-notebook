"use client";

import { useMemo } from "react";
import TodoSections from "../TodoSections";
import UpcomingSection from "../UpcomingSection";
import TodoItem from "../TodoItem";
import type { LayoutRendererProps } from "./types";
import type { Todo } from "@/app/types/admin";
import { format, parseISO } from "date-fns";

export default function SingleSectionLayout({
  transformedData,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  skippedTodoMap,
  onEditProject,
  recentStatsSection,
  selectedRulesetId,
}: LayoutRendererProps) {
  const upcomingSection = transformedData.upcomingTodosByDay && (
    <UpcomingSection
      upcomingTodosByDay={transformedData.upcomingTodosByDay}
      onComplete={onComplete}
      onEdit={onEdit}
      onDelete={onDelete}
      onWorkSession={onWorkSession}
      onRemoveWorkSession={onRemoveWorkSession}
      onSkipRecurring={onSkipRecurring}
      skippedTodoMap={skippedTodoMap}
    />
  );

  // Group tasks by month for the "everything" view
  const groupedByMonth = useMemo(() => {
    if (selectedRulesetId !== "everything") {
      return null;
    }

    // Collect all todos from all sections
    const allTodos: Todo[] = [];
    if (transformedData.allSections) {
      transformedData.allSections.forEach((section) => {
        let todos: Todo[];
        if ("documentId" in section) {
          // It's a Project
          todos = section.todos || [];
        } else {
          // It's a TodoGroup
          todos = section.todos;
        }
        allTodos.push(...todos);
      });
    }

    // Add incidentals to the pool of todos to be grouped
    if (transformedData.incidentals) {
      allTodos.push(...transformedData.incidentals);
    }

    // Group todos by creation month
    const todosByMonth = new Map<string, { date: Date; todos: Todo[] }>();
    
    allTodos.forEach((todo) => {
      try {
        const createdDate = parseISO(todo.createdAt);
        // Format as "YYYY-MM" for grouping, but keep the date for sorting
        const monthKey = format(createdDate, "yyyy-MM");
        
        if (!todosByMonth.has(monthKey)) {
          todosByMonth.set(monthKey, { date: createdDate, todos: [] });
        }
        todosByMonth.get(monthKey)!.todos.push(todo);
      } catch (error) {
        console.error("Error parsing date for todo:", todo.documentId, error);
      }
    });

    // Convert map to array and sort by date (oldest first)
    const sortedMonths = Array.from(todosByMonth.entries())
      .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime());

    // Create month groups with sorted todos
    return sortedMonths.map(([monthKey, { date, todos }]) => ({
      title: format(date, "MMMM yyyy"),
      // Sort todos within each month by creation date (oldest first)
      todos: todos.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      }),
    }));
  }, [transformedData.allSections, transformedData.incidentals, selectedRulesetId]);

  // Render custom layout for "everything" view
  if (selectedRulesetId === "everything" && groupedByMonth && groupedByMonth.length > 0) {
    return (
      <div className="todos-container">
        {upcomingSection}
        {recentStatsSection}
        <div className="todo-section">
          {groupedByMonth.map((monthGroup) => (
            <div key={monthGroup.title}>
              <h4>{monthGroup.title}</h4>
              <ul className="todos-list">
                {monthGroup.todos.map((todo) => (
                  <TodoItem
                    key={todo.documentId}
                    todo={todo}
                    onComplete={onComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onWorkSession={onWorkSession}
                    onRemoveWorkSession={onRemoveWorkSession}
                    onSkipRecurring={onSkipRecurring}
                    isSkipped={skippedTodoMap.has(todo.documentId)}
                    showProjectName={true}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default rendering for other views
  return (
    transformedData.allSections &&
    transformedData.allSections.length > 0 && (
      <TodoSections
        sections={transformedData.allSections}
        incidentals={transformedData.incidentals}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        onWorkSession={onWorkSession}
        onRemoveWorkSession={onRemoveWorkSession}
        onSkipRecurring={onSkipRecurring}
        skippedTodoMap={skippedTodoMap}
        showProjectName={true}
        onEditProject={onEditProject}
        upcomingSection={upcomingSection}
        recentStatsSection={recentStatsSection}
      />
    )
  );
}
