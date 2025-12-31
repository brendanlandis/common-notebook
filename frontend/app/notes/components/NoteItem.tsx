"use client";

import { useState, useEffect } from "react";
import { PencilIcon, TrashIcon } from "@phosphor-icons/react";
import type { Note } from "@/app/types/admin";
import { formatInEST } from "@/app/lib/dateUtils";
import { useTodoActions } from "@/app/contexts/TodoActionsContext";
import RichTextDisplay from "@/app/components/admin/RichTextDisplay";

interface NoteItemProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (documentId: string) => Promise<void>;
}

export default function NoteItem({ note, onEdit, onDelete }: NoteItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { openNoteForm } = useTodoActions();

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

  const handleEdit = () => {
    onEdit(note);
    openNoteForm();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    setIsDeleting(true);
    try {
      await onDelete(note.documentId);
    } finally {
      setIsDeleting(false);
    }
  };

  const createdDate = new Date(note.createdAt);
  const date = formatInEST(createdDate, "EE M/d/yy");

  return (
    <li>
      <div className="note-header">
        <span>{date}</span>
        <button
          className="note-action"
          onClick={handleEdit}
          aria-label="edit note"
          key={`edit-${themeKey}`}
        >
          <PencilIcon size={18} />
        </button>
        <button
          className="note-action"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="delete note"
          key={`delete-${themeKey}`}
        >
          <TrashIcon size={18} />
        </button>
      </div>
      {note.context && <div className="note-context">{note.context}</div>}
      <div className="note-content">
        <RichTextDisplay content={note.text} />
      </div>
    </li>
  );
}
