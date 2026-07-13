'use client';

import type { BlocksContent } from '@strapi/blocks-react-renderer';
import SlateEditor from '@/app/components/SlateEditor';

interface RichTextEditorProps {
  value: BlocksContent;
  onChange: (blocks: BlocksContent) => void;
}

// Thin wrapper kept for the existing call sites (task/project descriptions,
// practice notes). The editor itself is the shared Slate implementation in
// SlateEditor.tsx, which speaks Strapi Blocks JSON natively.
export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  return (
    <SlateEditor
      value={value}
      onChange={onChange}
      showHistory={false}
      showHeadings={false}
    />
  );
}
