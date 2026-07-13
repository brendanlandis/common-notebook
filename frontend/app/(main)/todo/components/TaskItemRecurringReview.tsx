"use client";

import { useState, useEffect } from "react";
import type { Task } from "@/app/types/index";
import { PencilIcon, TrashIcon, MapPinIcon, LinkIcon } from "@phosphor-icons/react";
import RichTextDisplay from "@/app/components/RichTextDisplay";
import { getRecurrencePrefix } from "@/app/lib/recurrenceLabels";

interface TaskItemRecurringReviewProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (documentId: string) => void;
}

export default function TaskItemRecurringReview({
  task,
  onEdit,
  onDelete,
}: TaskItemRecurringReviewProps) {
  const hasDescription = task.description && task.description.length > 0;

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

  // Generate the recurrence prefix
  const recurrencePrefix = getRecurrencePrefix(task);

  return (
    <li className="task-item-recurring-review">
      <div className="task-item-main">
        <div className="task-label">
          {recurrencePrefix && <span className="recurrence-prefix">{recurrencePrefix}: </span>}
          {task.title}
          {(task.category === "buy stuff" || task.category === "wishlist" || task.category === "errands") && task.price !== null && (
            <span className="task-due-date">
              (${task.price})
            </span>
          )}
        </div>
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
          <button onClick={() => onDelete(task.documentId)} key={`delete-${themeKey}`}>
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
