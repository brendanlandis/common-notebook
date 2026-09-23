'use client';

import { useState } from 'react';
import type { PracticeLog, StrapiBlock } from '@/app/types/index';
import RichTextEditor from '@/app/components/ui/RichTextEditor';
import Button from "@/app/components/ui/Button";
import { Field } from "@/app/components/ui/FormControls";

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
    <form className="practice-form flex flex-col gap-fields" onSubmit={handleFormSubmit}>
      <Field label="notes" htmlFor="notes">
        <RichTextEditor 
          value={notes}
          onChange={setNotes}
        />
      </Field>

      <div className="flex gap-controls">
        <Button type="submit">Save</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

