'use client';

import { useState } from 'react';
import type { PracticeLog, StrapiBlock } from '@/app/types/admin';
import RichTextEditor from '@/app/components/admin/RichTextEditor';

interface PracticeFormProps {
  practiceLog?: PracticeLog;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function PracticeForm({ practiceLog, onSubmit, onCancel }: PracticeFormProps) {
  const [notes, setNotes] = useState<StrapiBlock[]>(practiceLog?.notes || []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Helper to check if block is empty
    const isEmptyBlock = (block: StrapiBlock) => {
      if (block.type === 'paragraph') {
        if (!block.children || block.children.length === 0) return true;
        return block.children.every(child => 
          child.type === 'text' && (!child.text || child.text.trim() === '')
        );
      }
      return false;
    };
    
    // Filter out all empty blocks
    let trimmedNotes = notes.filter(block => !isEmptyBlock(block));
    
    onSubmit({ notes: trimmedNotes });
  };

  return (
    <form className="practice-form" onSubmit={handleFormSubmit}>
      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <RichTextEditor 
          value={notes}
          onChange={setNotes}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn">
          Save
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

