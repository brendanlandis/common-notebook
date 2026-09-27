'use client';

import type { BlocksContent } from '@strapi/blocks-react-renderer';
import SlateEditor from '@/app/components/ui/SlateEditor';

interface RichTextEditorProps {
  value: BlocksContent;
  onChange: (blocks: BlocksContent) => void;
  placeholder?: string;
}

// Thin wrapper kept for the existing call sites (task/project descriptions,
// practice notes). The editor itself is the shared Slate implementation in
// SlateEditor.tsx, which speaks Strapi Blocks JSON natively.
export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <SlateEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      showHistory={false}
      showHeadings={false}
    />
  );
}
