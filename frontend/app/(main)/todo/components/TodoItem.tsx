"use client";

import {
  differenceInDays,
  isPast,
  isToday,
  isTomorrow,
} from "date-fns";
import { useState, useEffect } from "react";
import type { Todo } from "@/app/types/admin";
import { PencilIcon, TrashIcon, MapPinIcon, LinkIcon, CookieIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
import { getNowInEST, parseInEST, formatInEST } from "@/app/lib/dateUtils";
import RichTextDisplay from "@/app/components/admin/RichTextDisplay";

interface TodoItemProps {
  todo: Todo;
  onComplete: (documentId: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession?: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  isSkipped?: boolean;
  showProjectName?: boolean;
}

export default function TodoItem({
  todo,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  isSkipped = false,
  showProjectName = false,
}: TodoItemProps) {
  const [isChecked, setIsChecked] = useState(todo.completed);
  const hasDescription = todo.description && todo.description.length > 0;

  const [themeKey, setThemeKey] = useState(0);
  
  useEffect(() => {
    // Listen for theme changes and force button remount
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemeKey(prev => prev + 1);
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);

  // Check if this is a "worked on" virtual entry
  // Pattern: originalDocumentId-worked-YYYY-MM-DD
  const workedOnMatch = todo.documentId.match(/^(.+)-worked-(\d{4}-\d{2}-\d{2})$/);
  const isWorkedOnEntry = workedOnMatch !== null;
  const originalDocumentId = workedOnMatch ? workedOnMatch[1] : null;
  const workSessionDate = workedOnMatch ? workedOnMatch[2] : null;

  // Sync local state with prop changes
  useEffect(() => {
    setIsChecked(todo.completed);
  }, [todo.completed]);

  const formatDueDate = (dateString: string) => {
    const date = parseInEST(dateString);
    const now = getNowInEST();
    const daysUntilDue = differenceInDays(date, now);

    if (isToday(date)) {
      return "today";
    }
    if (isTomorrow(date)) {
      return "tomorrow";
    }
    if (isPast(date)) {
      const daysAgo = Math.abs(daysUntilDue);
      if (daysAgo === 1) {
        return "yesterday";
      }
      if (daysAgo === 2) {
        return "a couple days ago";
      }
      if (daysAgo >= 3 && daysAgo <= 6) {
        return "a few days ago";
      }
      if (daysAgo >= 7 && daysAgo <= 13) {
        return "a week ago";
      }
      if (daysAgo >= 14 && daysAgo <= 20) {
        return "two weeks ago";
      }
      if (daysAgo >= 21 && daysAgo <= 27) {
        return "three weeks ago";
      }
      if (daysAgo >= 28 && daysAgo <= 34) {
        return "a month ago";
      }
      return "over a month ago";
    }
    if (daysUntilDue < 7) {
      return formatInEST(date, "EEEE").toLowerCase();
    }
    return `in ${daysUntilDue} days`;
  };

  const formatCompletedTime = (completedAt: string) => {
    const date = new Date(completedAt);
    return formatInEST(date, "h:mm a");
  };

  return (
    <li className={isChecked || isSkipped ? 'completed' : ''}>
      <div className="todo-item-main">
        <input
          type="checkbox"
          className="checkbox"
          id={`todo-${todo.documentId}`}
          checked={isChecked}
          onChange={(e) => {
            const newCheckedState = e.target.checked;
            setIsChecked(newCheckedState);
            onComplete(todo.documentId);
          }}
          aria-label="mark complete"
        />
        {todo.long && !isWorkedOnEntry && (
          <button
            className="cookie-icon"
            onClick={() => onWorkSession(todo.documentId)}
            title="mark as worked on today"
            aria-label="mark as worked on today"
          >
            <CookieIcon size={25} />
          </button>
        )}
        {isWorkedOnEntry && onRemoveWorkSession && originalDocumentId && workSessionDate && (
          <button
            className="cookie-icon"
            onClick={() => onRemoveWorkSession(originalDocumentId, workSessionDate)}
            title="remove work session"
            aria-label="remove work session"
          >
            <CookieIcon size={25} />
          </button>
        )}
        {todo.isRecurring && !isWorkedOnEntry && (
          <button
            className="skip-recurring-icon"
            onClick={() => onSkipRecurring(todo.documentId)}
            title="skip this one"
            aria-label="skip this one"
          >
            <ArrowClockwiseIcon size={20} />
          </button>
        )}
        <label htmlFor={`todo-${todo.documentId}`}>
          {!isWorkedOnEntry && todo.completed && todo.completedAt && (
            <span className="todo-completed-time">
              {formatCompletedTime(todo.completedAt)}{" "}
            </span>
          )}
          {isWorkedOnEntry && todo.completedAt && (
            <span className="todo-completed-time">
              {formatCompletedTime(todo.completedAt)}{" "}
            </span>
          )}
          {showProjectName && todo.project && (
            <span>{(todo.project as any).title}: </span>
          )}
          {todo.title}
          {!todo.isRecurring && todo.dueDate && (
            <span className="todo-due-date">
              (due {formatDueDate(todo.dueDate)})
            </span>
          )}
          {todo.isRecurring && todo.dueDate && todo.displayDate && (
            <span className="todo-due-date">
              (due {formatDueDate(todo.dueDate)})
            </span>
          )}
          {(todo.category === "buy stuff" || todo.category === "wishlist" || todo.category === "errands") && todo.price !== null && (
            <span className="todo-due-date">
              (${todo.price})
            </span>
          )}
        </label>
        <span className="todo-actions">
          {todo.trackingUrl && (
            <a
              href={todo.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="tracking url"
            >
              <MapPinIcon size={18} />
            </a>
          )}
          {todo.purchaseUrl && (
            <a
              href={todo.purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="purchase url"
            >
              <LinkIcon size={18} />
            </a>
          )}
          <button onClick={() => onEdit(todo)} key={`edit-${themeKey}`}>
            <PencilIcon size={18} />
          </button>
          <button onClick={() => onDelete(todo.documentId)} key={`delete-${themeKey}`}>
            <TrashIcon size={18} />
          </button>
        </span>
      </div>

      {hasDescription && (
        <div className="todo-description">
          <RichTextDisplay content={todo.description} />
        </div>
      )}
    </li>
  );
}

