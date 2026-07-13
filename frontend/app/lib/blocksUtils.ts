import type { BlocksContent } from '@strapi/blocks-react-renderer';

// Loose recursive node shape for walking Strapi blocks text.
interface RichTextNode {
  type?: string;
  text?: string;
  children?: RichTextNode[];
  [key: string]: unknown;
}

/**
 * Extract text from children nodes recursively
 */
function extractTextFromChildren(children: RichTextNode[]): string {
  if (!children || !Array.isArray(children)) {
    return '';
  }

  return children
    .map(child => {
      if (child.type === 'text' && 'text' in child) {
        return (child as { text: string }).text;
      }
      // Extract text from link children
      if (child.type === 'link' && child.children) {
        return extractTextFromChildren(child.children);
      }
      // Recursively handle nested children
      if (child.children) {
        return extractTextFromChildren(child.children);
      }
      return '';
    })
    .join('');
}

/**
 * Extract plain text from BlocksContent
 * Useful for generating excerpts or search text
 * 
 * @param blocks - The BlocksContent to extract text from
 * @returns plain text string
 */
export function extractTextFromBlocks(blocks: BlocksContent | null | undefined): string {
  if (!blocks || !Array.isArray(blocks)) {
    return '';
  }

  return (blocks as unknown as RichTextNode[])
    .map(block => {
      // Handle paragraph blocks
      if (block.type === 'paragraph' && block.children) {
        return extractTextFromChildren(block.children);
      }
      
      // Handle heading blocks (h1-h6)
      if (block.type === 'heading' && block.children) {
        return extractTextFromChildren(block.children);
      }
      
      // Handle list blocks (ordered and unordered)
      // List items are children of list blocks and will be handled recursively
      if (block.type === 'list' && block.children) {
        return extractTextFromChildren(block.children);
      }
      
      // Handle quote blocks
      if (block.type === 'quote' && block.children) {
        return extractTextFromChildren(block.children);
      }
      
      // Handle code blocks
      if (block.type === 'code' && block.children) {
        return extractTextFromChildren(block.children);
      }
      
      // Handle image blocks - images have meaningful content even without text
      if (block.type === 'image') {
        return '[image]'; // Return placeholder to indicate content exists
      }
      
      // Handle any other blocks with children
      if (block.children) {
        return extractTextFromChildren(block.children);
      }
      
      return '';
    })
    .filter(text => text.trim().length > 0)
    .join(' ');
} 