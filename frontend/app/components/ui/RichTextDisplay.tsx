'use client';

import { BlocksRenderer, type BlocksContent } from '@strapi/blocks-react-renderer';

interface RichTextDisplayProps {
  content: BlocksContent;
}

export default function RichTextDisplay({ content }: RichTextDisplayProps) {
  return (
    <div className="rich-text-content">
      <BlocksRenderer
        content={content}
        blocks={{
          // Preserve Shift+Enter soft line breaks (stored as "\n" inside a text
          // node — Strapi Blocks has no hard-break node) so they render as
          // visible breaks the way they appear in the editor.
          paragraph: ({ children }) => (
            <p style={{ whiteSpace: 'pre-wrap' }}>{children}</p>
          ),
          quote: ({ children }) => (
            <blockquote style={{ whiteSpace: 'pre-wrap' }}>{children}</blockquote>
          ),
        }}
      />
    </div>
  );
}
