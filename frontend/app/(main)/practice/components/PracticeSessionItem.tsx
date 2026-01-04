"use client";

import { useState } from "react";
import { PencilIcon, TrashIcon } from "@phosphor-icons/react";
import type { PracticeLog } from "@/app/types/admin";
import { formatInEST } from "@/app/lib/dateUtils";
import PracticeForm from "./PracticeForm";
import RichTextDisplay from "@/app/components/admin/RichTextDisplay";

interface PracticeSessionItemProps {
  practiceLog: PracticeLog;
  onUpdate: (documentId: string, data: any) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
}

export default function PracticeSessionItem({
  practiceLog,
  onUpdate,
  onDelete,
}: PracticeSessionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSubmit = async (data: any) => {
    await onUpdate(practiceLog.documentId, data);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this practice session?"))
      return;
    setIsDeleting(true);
    try {
      await onDelete(practiceLog.documentId);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };


  if (isEditing) {
    return (
      <div className="practice-session-item editing">
        <PracticeForm
          practiceLog={practiceLog}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  const startDate = new Date(practiceLog.start);
  const date = formatInEST(startDate, "EEEE M/d");

  return (
    <div className="practice-session-item">
      <div className="session-header">
        <div className="session-date-time">
          <span className="date">{date}</span>
        </div>
        <div className="session-duration">
          {formatDuration(practiceLog.duration)}
        </div>
        <div className="session-actions">
          <button
            type="button"
            className="button-icon"
            onClick={handleEdit}
            aria-label="Edit session"
          >
            <PencilIcon size={20} weight="regular" />
          </button>
          <button
            type="button"
            className="button-icon"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete session"
          >
            <TrashIcon size={20} weight="regular" />
          </button>
        </div>
      </div>
      {practiceLog.notes && practiceLog.notes.length > 0 && (
        <div className="session-notes">
          <RichTextDisplay content={practiceLog.notes} />
        </div>
      )}
    </div>
  );
}
