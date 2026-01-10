"use client";

import { useState, useEffect } from "react";
import type { Todo } from "@/app/types/index";
import { PencilIcon, TrashIcon, MapPinIcon, LinkIcon } from "@phosphor-icons/react";
import RichTextDisplay from "@/app/components/RichTextDisplay";
import { getRecurrencePrefix } from "@/app/lib/recurrenceLabels";

interface TodoItemRecurringReviewProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (documentId: string) => void;
}

export default function TodoItemRecurringReview({
  todo,
  onEdit,
  onDelete,
}: TodoItemRecurringReviewProps) {
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

  // Generate the recurrence prefix
  const recurrencePrefix = getRecurrencePrefix(todo);

  return (
    <li className="todo-item-recurring-review">
      <div className="todo-item-main">
        <div className="todo-label">
          {recurrencePrefix && <span className="recurrence-prefix">{recurrencePrefix}: </span>}
          {todo.title}
          {(todo.category === "buy stuff" || todo.category === "wishlist" || todo.category === "errands") && todo.price !== null && (
            <span className="todo-due-date">
              (${todo.price})
            </span>
          )}
        </div>
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
