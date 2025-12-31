import type { StrapiBlock, StrapiInlineNode, StrapiParagraphBlock, StrapiListBlock, StrapiHeadingBlock, StrapiQuoteBlock } from '@/app/types/admin';
import type { JSONContent } from '@tiptap/react';

/**
 * Convert Strapi Blocks to Tiptap JSON format
 */
export function strapiBlocksToTiptap(blocks: StrapiBlock[]): JSONContent {
  if (!blocks || blocks.length === 0) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [],
        },
      ],
    };
  }

  const content = blocks
    .map((block): JSONContent | null => {
      if (block.type === 'paragraph') {
        const inlineContent = block.children.map(inlineNodeToTiptap).filter((node): node is JSONContent => node !== null);
        return {
          type: 'paragraph',
          content: inlineContent.length > 0 ? inlineContent : [],
        };
      } else if (block.type === 'heading') {
        const inlineContent = block.children.map(inlineNodeToTiptap).filter((node): node is JSONContent => node !== null);
        return {
          type: 'heading',
          attrs: { level: block.level },
          content: inlineContent.length > 0 ? inlineContent : [],
        };
      } else if (block.type === 'quote') {
        const inlineContent = block.children.map(inlineNodeToTiptap).filter((node): node is JSONContent => node !== null);
        return {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: inlineContent.length > 0 ? inlineContent : [],
            },
          ],
        };
      } else if (block.type === 'list') {
        const listType = block.format === 'ordered' ? 'orderedList' : 'bulletList';
        return {
          type: listType,
          content: block.children.map((listItem) => {
            const inlineContent = listItem.children.map(inlineNodeToTiptap).filter((node): node is JSONContent => node !== null);
            return {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: inlineContent.length > 0 ? inlineContent : [],
                },
              ],
            };
          }),
        };
      }
      return null;
    })
    .filter((item): item is JSONContent => item !== null);

  return {
    type: 'doc',
    content,
  };
}

/**
 * Convert a Strapi inline node (text or link) to Tiptap node
 */
function inlineNodeToTiptap(node: StrapiInlineNode): JSONContent | null {
  if (node.type === 'link') {
    const text = node.children.map(child => child.text).join('');
    // Skip empty text nodes
    if (!text) return null;
    
    return {
      type: 'text',
      text,
      marks: [
        { type: 'link', attrs: { href: node.url } },
        // Include any formatting from the first child
        ...(node.children[0]?.bold ? [{ type: 'bold' }] : []),
        ...(node.children[0]?.italic ? [{ type: 'italic' }] : []),
        ...(node.children[0]?.underline ? [{ type: 'underline' }] : []),
        ...(node.children[0]?.strikethrough ? [{ type: 'strike' }] : []),
        ...(node.children[0]?.code ? [{ type: 'code' }] : []),
      ],
    };
  }
  
  // Skip empty text nodes
  if (!node.text) return null;
  
  // Regular text node
  const marks: any[] = [];
  
  if (node.bold) marks.push({ type: 'bold' });
  if (node.italic) marks.push({ type: 'italic' });
  if (node.underline) marks.push({ type: 'underline' });
  if (node.strikethrough) marks.push({ type: 'strike' });
  if (node.code) marks.push({ type: 'code' });

  return {
    type: 'text',
    text: node.text,
    ...(marks.length > 0 && { marks }),
  };
}

/**
 * Check if a block is empty (paragraph with no text content)
 */
function isEmptyBlock(block: StrapiBlock): boolean {
  if (block.type === 'paragraph') {
    // Empty if no children
    if (!block.children || block.children.length === 0) {
      return true;
    }
    // Empty if all children are empty text nodes
    return block.children.every(child => 
      child.type === 'text' && (!child.text || child.text.trim() === '')
    );
  }
  return false;
}

/**
 * Convert Tiptap JSON to Strapi Blocks format
 */
export function tiptapToStrapiBlocks(tiptapJson: JSONContent): StrapiBlock[] {
  if (!tiptapJson?.content) {
    return [];
  }

  const blocks: StrapiBlock[] = [];

  for (const node of tiptapJson.content) {
    if (node.type === 'paragraph') {
      const paragraph: StrapiParagraphBlock = {
        type: 'paragraph',
        children: extractInlineNodes(node.content || []),
      };
      blocks.push(paragraph);
    } else if (node.type === 'heading') {
      const heading: StrapiHeadingBlock = {
        type: 'heading',
        level: (node.attrs?.level || 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: extractInlineNodes(node.content || []),
      };
      blocks.push(heading);
    } else if (node.type === 'blockquote') {
      // Blockquote contains paragraphs, extract text from first paragraph
      const paragraphContent = node.content?.[0]?.content || [];
      const quote: StrapiQuoteBlock = {
        type: 'quote',
        children: extractInlineNodes(paragraphContent),
      };
      blocks.push(quote);
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const list: StrapiListBlock = {
        type: 'list',
        format: node.type === 'orderedList' ? 'ordered' : 'unordered',
        children: (node.content || []).map((listItem) => {
          // Extract inline content from the paragraph inside the list item
          const paragraphContent = listItem.content?.[0]?.content || [];
          return {
            type: 'list-item' as const,
            children: extractInlineNodes(paragraphContent),
          };
        }),
      };
      blocks.push(list);
    }
  }

  // Remove empty paragraphs from the beginning (but keep at least one block)
  while (blocks.length > 1 && isEmptyBlock(blocks[0])) {
    blocks.shift();
  }

  // Remove empty paragraphs from the end (but keep at least one block)
  while (blocks.length > 1 && isEmptyBlock(blocks[blocks.length - 1])) {
    blocks.pop();
  }

  return blocks;
}

/**
 * Extract inline nodes (text and links) from Tiptap content, converting marks to Strapi format
 */
function extractInlineNodes(content: JSONContent[]): StrapiInlineNode[] {
  if (!content || content.length === 0) {
    return [];
  }

  const nodes = content.map((node) => {
    if (node.type === 'text') {
      // Check if this text has a link mark
      const linkMark = node.marks?.find(mark => mark.type === 'link');
      const linkUrl = linkMark?.attrs?.href;
      
      // Helper to check if URL is valid (has protocol or is relative)
      const isValidUrl = (url: string) => {
        if (!url || url.trim() === '') return false;
        // Check if it starts with http://, https://, //, /, mailto:, tel:, etc.
        return /^(https?:\/\/|\/\/|\/|mailto:|tel:|#)/.test(url.trim());
      };
      
      // Only create a link node if there's a valid URL
      if (linkMark && linkUrl && isValidUrl(linkUrl)) {
        // Create a link node
        const textNode: any = {
          type: 'text',
          text: node.text || '',
        };
        
        // Add formatting to the text node
        if (node.marks) {
          for (const mark of node.marks) {
            if (mark.type === 'bold') textNode.bold = true;
            if (mark.type === 'italic') textNode.italic = true;
            if (mark.type === 'underline') textNode.underline = true;
            if (mark.type === 'strike') textNode.strikethrough = true;
            if (mark.type === 'code') textNode.code = true;
          }
        }
        
        return {
          type: 'link' as const,
          url: linkUrl,
          children: [textNode],
        };
      }
      
      // Regular text node (including text that had empty link URLs)
      const textNode: any = {
        type: 'text',
        text: node.text || '',
      };

      // Convert Tiptap marks to Strapi text formatting (skip link marks since we're treating this as regular text)
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') textNode.bold = true;
          if (mark.type === 'italic') textNode.italic = true;
          if (mark.type === 'underline') textNode.underline = true;
          if (mark.type === 'strike') textNode.strikethrough = true;
          if (mark.type === 'code') textNode.code = true;
          // Skip 'link' marks since we don't have a valid URL
        }
      }

      return textNode;
    }
    // Fallback for unexpected node types - return null to be filtered out
    return null;
  });
  
  // Filter out null values
  return nodes.filter((node): node is StrapiInlineNode => node !== null);
}
