import { Descendant, Element as SlateElement, Text } from "slate";
import type { BlocksContent } from "@strapi/blocks-react-renderer";

// Loose shape for the recursive Slate/Strapi node transforms below. These
// deliberately add/remove non-standard fields (`type`, `level`, list `format`),
// so a permissive node type with an index signature fits better than the strict
// Slate/Strapi types.
type SlateLikeNode = {
  type?: string;
  format?: string;
  level?: unknown;
  text?: string;
  children?: SlateLikeNode[];
  [key: string]: unknown;
};

/**
 * Convert BlocksContent (Strapi format) to Slate value
 * Removes the "type: text" field from text nodes as Slate doesn't need it
 */
export const blocksContentToSlateValue = (blocks: BlocksContent | null | undefined): Descendant[] => {
  // Handle null, undefined, or empty array
  if (!blocks || blocks.length === 0) {
    return [
      {
        type: "paragraph",
        children: [{ text: "" }],
      } as SlateElement,
    ];
  }

  // Transform Strapi format to Slate format
  // Remove the "type: text" field from text nodes
  const transformNode = (node: SlateLikeNode): SlateLikeNode => {
    // If it's a text node with type: "text", remove the type field
    if (node.type === "text" && "text" in node) {
      const { type: _type, ...rest } = node;
      return rest as SlateLikeNode;
    }

    // Convert Strapi's 'list' with format to Slate's 'numbered-list' or 'bulleted-list'
    if (node.type === "list" && node.format) {
      return {
        type: node.format === "ordered" ? "numbered-list" : "bulleted-list",
        children: node.children!.map(transformNode),
      };
    }

    // If it's an element with children, recursively transform children
    if (node.children && Array.isArray(node.children)) {
      const transformedNode: SlateLikeNode = {
        ...node,
        children: node.children.map(transformNode),
      };

      // Remove invalid properties from specific node types
      // List items should not have a 'level' property (only headings should)
      if (node.type === "list-item" && "level" in transformedNode) {
        delete transformedNode.level;
      }

      return transformedNode;
    }

    return node;
  };

  return (blocks as unknown as SlateLikeNode[]).map(transformNode) as unknown as Descendant[];
};

/**
 * Convert Slate value to BlocksContent (Strapi format)
 * Recursively transforms text nodes to include the required "type: text" field
 */
export const slateValueToBlocksContent = (value: Descendant[] | null | undefined): BlocksContent => {
  // Handle null or undefined
  if (!value || value.length === 0) {
    return [];
  }

  // If it's just an empty paragraph, return empty array
  const firstNode = value[0];
  if (
    value.length === 1 &&
    SlateElement.isElement(firstNode) &&
    (firstNode as unknown as { type: string }).type === "paragraph" &&
    firstNode.children?.length === 1 &&
    Text.isText(firstNode.children[0]) &&
    firstNode.children[0].text === ""
  ) {
    return [];
  }

  // Transform Slate format to Strapi format
  // Strapi requires text nodes to have {type: "text", text: "..."} while Slate uses {text: "..."}
  const transformNode = (node: SlateLikeNode): SlateLikeNode => {
    // If it's a text node, add the type field
    if (Text.isText(node)) {
      return {
        type: "text",
        ...node,
      };
    }

    // Convert Slate's 'numbered-list' or 'bulleted-list' to Strapi's 'list' with format
    if (node.type === "numbered-list" || node.type === "bulleted-list") {
      return {
        type: "list",
        format: node.type === "numbered-list" ? "ordered" : "unordered",
        children: node.children!.map(transformNode),
      };
    }

    // If it's an element with children, recursively transform children
    if (SlateElement.isElement(node) && node.children) {
      const transformedNode: SlateLikeNode = {
        ...node,
        children: (node.children as unknown as SlateLikeNode[]).map(transformNode),
      };
      
      // Remove invalid properties from specific node types
      // List items should not have a 'level' property (only headings should)
      if (node.type === "list-item" && "level" in transformedNode) {
        delete transformedNode.level;
      }
      
      return transformedNode;
    }

    return node;
  };

  return (value as unknown as SlateLikeNode[]).map(transformNode) as unknown as BlocksContent;
};

/**
 * Check if BlocksContent is empty (null, undefined, empty array, or just empty paragraph)
 */
export const isBlocksContentEmpty = (blocks: BlocksContent | null | undefined): boolean => {
  if (!blocks || blocks.length === 0) {
    return true;
  }

  // Check if it's just an empty paragraph
  const firstBlock = blocks[0];
  if (
    blocks.length === 1 &&
    firstBlock.type === "paragraph" &&
    firstBlock.children?.length === 1 &&
    firstBlock.children[0].type === "text" &&
    firstBlock.children[0].text === ""
  ) {
    return true;
  }

  return false;
};

