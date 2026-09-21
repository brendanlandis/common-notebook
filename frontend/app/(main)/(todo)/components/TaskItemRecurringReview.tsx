"use client";

import { useState, useEffect } from "react";
import type { Task } from "@/app/types/index";
import { getTaskProjectType } from "@/app/lib/taskProjectType";
import { PencilIcon, TrashIcon, MapPinIcon, LinkIcon } from "@phosphor-icons/react";
import RichTextDisplay from "@/app/components/ui/RichTextDisplay";
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
    <li>
      <div className="flex items-center gap-2 leading-tight touch:gap-4">
        <div className="task-label">
          {recurrencePrefix && <span className="font-semibold">{recurrencePrefix}: </span>}
          {task.title}
          {(() => {
            const projectType = getTaskProjectType(task);
            return (projectType === "buy stuff" || projectType === "wishlist" || projectType === "errands") && task.price !== null;
          })() && (
            <span> (${task.price})</span>
          )}
        </div>
        {/* Always out: this view is a review, so every row is being acted on. */}
        <span className="flex flex-1 justify-start justify-self-start">
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
        <div className="mr-0 border border-dashed border-base-content bg-base-200 px-[0.7rem] py-2">
          {/* A note reads one step below its task. */}
          <RichTextDisplay content={task.description} className="text-small" />
        </div>
      )}
    </li>
  );
}
