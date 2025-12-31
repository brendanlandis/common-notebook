'use client';

import { BlocksRenderer } from '@strapi/blocks-react-renderer';
import type { StrapiBlock } from '@/app/types/admin';

interface RichTextDisplayProps {
  content: StrapiBlock[];
}

export default function RichTextDisplay({ content }: RichTextDisplayProps) {
  return (
    <div className="rich-text-content">
      <BlocksRenderer content={content} />
    </div>
  );
}

