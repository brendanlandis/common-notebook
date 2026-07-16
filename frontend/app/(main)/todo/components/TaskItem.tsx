"use client";

import { differenceInDays, isPast, isToday, isTomorrow } from "date-fns";
import { useState, useEffect } from "react";
import type { Task } from "@/app/types/index";
import { getTaskProjectType } from "@/app/lib/taskProjectType";
import {
  PencilIcon,
  TrashIcon,
  MapPinIcon,
  LinkIcon,
  CookieIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react";
import { getNow, parseDate, formatInTimezone } from "@/app/lib/dateUtils";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import RichTextDisplay from "@/app/components/RichTextDisplay";

interface TaskItemProps {
  task: Task;
  onComplete: (documentId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (documentId: string) => void;
  onWorkSession: (documentId: string) => void;
  onRemoveWorkSession?: (originalDocumentId: string, date: string) => void;
  onSkipRecurring: (documentId: string) => void;
  showProjectName?: boolean;
}

export default function TaskItem({
  task,
  onComplete,
  onEdit,
  onDelete,
  onWorkSession,
  onRemoveWorkSession,
  onSkipRecurring,
  showProjectName = false,
}: TaskItemProps) {
  const { timeZoneSettings } = useDateTimeSettings();
  const [isChecked, setIsChecked] = useState(task.completed);
  const hasDescription = task.description && task.description.length > 0;

  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    // Listen for theme changes and force button remount
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemeKey((prev) => prev + 1);
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  // Check if this is a "worked on" virtual entry
  // Pattern: originalDocumentId-worked-YYYY-MM-DD
  const workedOnMatch = task.documentId.match(
    /^(.+)-worked-(\d{4}-\d{2}-\d{2})$/
  );
  const isWorkedOnEntry = workedOnMatch !== null;
  const originalDocumentId = workedOnMatch ? workedOnMatch[1] : null;
  const workSessionDate = workedOnMatch ? workedOnMatch[2] : null;

  // Sync local state with prop changes
  useEffect(() => {
    setIsChecked(task.completed);
  }, [task.completed]);

  const formatDueDate = (dateString: string) => {
    const date = parseDate(dateString, timeZoneSettings);
    const now = getNow(timeZoneSettings);
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
      return formatInTimezone(date, "EEEE", timeZoneSettings).toLowerCase();
    }
    return `in ${daysUntilDue} days`;
  };

  const formatCompletedTime = (completedAt: string) => {
    const date = new Date(completedAt);
    return formatInTimezone(date, "h:mm a", timeZoneSettings);
  };

  return (
    <li
      className={
        isWorkedOnEntry
          ? "worked-on"
          : isChecked
          ? "completed"
          : (task as any).workedOnPhase === 1
          ? "worked-on"
          : ""
      }
    >
      <div className="task-item-main">
        <input
          type="checkbox"
          className="checkbox"
          id={`task-${task.documentId}`}
          checked={isChecked}
          onChange={(e) => {
            const newCheckedState = e.target.checked;
            setIsChecked(newCheckedState);
            onComplete(task.documentId);
          }}
          aria-label="mark complete"
        />
        {task.long && !isWorkedOnEntry && (
          <button
            className="cookie-icon"
            onClick={() => onWorkSession(task.documentId)}
            title="mark as worked on today"
            aria-label="mark as worked on today"
          >
            <CookieIcon size={25} />
          </button>
        )}
        {isWorkedOnEntry &&
          onRemoveWorkSession &&
          originalDocumentId &&
          workSessionDate && (
            <button
              className="cookie-icon"
              onClick={() =>
                onRemoveWorkSession(originalDocumentId, workSessionDate)
              }
              title="remove work session"
              aria-label="remove work session"
            >
              <CookieIcon size={25} />
            </button>
          )}
        {task.isRecurring && !isWorkedOnEntry && (
          <button
            className="skip-recurring-icon"
            onClick={() => onSkipRecurring(task.documentId)}
            title="skip this one"
            aria-label="skip this one"
          >
            <ArrowClockwiseIcon size={20} />
          </button>
        )}
        <label htmlFor={`task-${task.documentId}`}>
          {isWorkedOnEntry && (
            <span>worked on </span>
          )}
          {showProjectName && task.project && (
            <span>{(task.project as any).title}: </span>
          )}
          {task.title}
          {!task.isRecurring && task.dueDate && (
            <span className="task-due-date">
              (due {formatDueDate(task.dueDate)})
            </span>
          )}
          {task.isRecurring && task.dueDate && task.displayDate && (
            <span className="task-due-date">
              (due {formatDueDate(task.dueDate)})
            </span>
          )}
          {(() => {
            const projectType = getTaskProjectType(task);
            return (projectType === "buy stuff" ||
              projectType === "wishlist" ||
              projectType === "errands") &&
              task.price !== null;
          })() && <span className="task-due-date">(${task.price})</span>}
        </label>
        <span className="task-actions">
          {task.trackingUrl && (
            <a
              href={task.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="tracking url"
            >
              <MapPinIcon size={18} />
            </a>
          )}
          {task.purchaseUrl && (
            <a
              href={task.purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="purchase url"
            >
              <LinkIcon size={18} />
            </a>
          )}
          <button onClick={() => onEdit(task)} key={`edit-${themeKey}`}>
            <PencilIcon size={18} />
          </button>
          <button
            onClick={() => onDelete(task.documentId)}
            key={`delete-${themeKey}`}
          >
            <TrashIcon size={18} />
          </button>
        </span>
      </div>

      {hasDescription && (
        <div className="task-description">
          <RichTextDisplay content={task.description} />
        </div>
      )}
    </li>
  );
}
