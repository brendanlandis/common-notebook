"use client";

import type { Task } from "@/app/types/index";

/**
 * A list of tasks you pick from — the selection primitive both the review and
 * the daily page are built from.
 *
 * **Pills, not checkboxes.** In a task app a checkbox beside a task means one
 * thing, and it isn't this: it means tick it off, it's done. Every other list in
 * this app uses it that way. Nothing here completes anything — you're choosing
 * what to pay attention to — so it can't borrow the control that says otherwise.
 * A pressed/unpressed pill has no such prior meaning, and `aria-pressed` says
 * the same thing to a screen reader that the fill says to an eye.
 *
 * The selected fill is deliberately the same color as a kept calendar event:
 * across this feature, filled means "yes, this one".
 *
 * Renders no dates, no age, and no urgency of any kind. That isn't an oversight
 * to be filled in later: this is a planning surface, and the moment it starts
 * saying "3 days overdue" it becomes a productivity tool that makes you feel
 * behind rather than one that helps you decide.
 */

interface TaskPickListProps {
  tasks: Task[];
  selected: Set<string>;
  onToggle: (documentId: string) => void;
  emptyMessage?: string;
  /**
   * Show the tasks without offering to change them — the daily page's reading
   * view. Pills would invite a click that does nothing, and the checkboxes this
   * replaced looked, there, exactly like a list of things to tick off.
   */
  readOnly?: boolean;
  /**
   * Off where a project heading already sits above the list — repeating it on
   * every pill is most of what made a long list read as a wall.
   */
  showProject?: boolean;
}

export default function TaskPickList({
  tasks,
  selected,
  onToggle,
  emptyMessage,
  readOnly = false,
  showProject = true,
}: TaskPickListProps) {
  if (tasks.length === 0) {
    return emptyMessage ? <p className="review-empty">{emptyMessage}</p> : null;
  }

  if (readOnly) {
    return (
      <ul className="review-task-list">
        {tasks.map((task) => (
          <li key={task.documentId}>
            <span>{task.title}</span>
            {showProject && task.project?.title && (
              <span className="review-pick-project">{task.project.title}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="review-pick-list">
      {tasks.map((task) => {
        const isSelected = selected.has(task.documentId);
        return (
          <li key={task.documentId}>
            <button
              type="button"
              className={`review-pill${isSelected ? " is-selected" : ""}`}
              aria-pressed={isSelected}
              /* Names this pill for the view transition that runs when picking
                 moves it between the two lists, so the browser tweens it from
                 where it was to where it lands. Inert outside a transition.

                 It has to be unique in the document: duplicate names make the
                 browser abandon the whole transition. A task appears at most
                 once on this page — `buildReviewLists` dedupes and
                 `partitionSelected` moves rather than copies — and the daily
                 page renders only one of these lists at a time. */
              style={{ viewTransitionName: `pill-${task.documentId}` }}
              onClick={() => onToggle(task.documentId)}
            >
              <span>{task.title}</span>
              {/* The project, only where it isn't already implied by the heading
                  above the list. Context, not status. */}
              {showProject && task.project?.title && (
                <span className="review-pick-project">{task.project.title}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
