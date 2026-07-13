"use client";

// Shared with slownames.net (src/components/SlateEditor.tsx). Keep the two
// structurally identical — the only intended differences are the import paths
// for slateUtils and the CSS. Port fixes to both.

import React, { useCallback, useMemo, useEffect } from "react";
import {
  createEditor,
  Descendant,
  Editor,
  Transforms,
  Element as SlateElement,
  BaseEditor,
  Range,
  Node as SlateNode,
  Path,
} from "slate";
import {
  Slate,
  Editable,
  withReact,
  RenderLeafProps,
  RenderElementProps,
  ReactEditor,
} from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import type { BlocksContent } from "@strapi/blocks-react-renderer";
import {
  blocksContentToSlateValue,
  slateValueToBlocksContent,
} from "@/app/lib/slateUtils";
import {
  TextBIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  CodeBlockIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  TextHFourIcon,
  TextHFiveIcon,
  TextHSixIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  CodeSimpleIcon,
  LinkIcon,
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react";
import "@/app/css/SlateEditor.css";

interface SlateEditorProps {
  value: BlocksContent;
  onChange: (value: BlocksContent) => void;
  placeholder?: string;
  disabled?: boolean;
  // Toolbar groups, on by default. Consumers can hide the ones they don't want
  // (e.g. Common Notebook hides undo/redo and headings) without forking this
  // shared component.
  showHistory?: boolean;
  showHeadings?: boolean;
}

// Define custom types for our editor
type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

type ParagraphElement = {
  type: "paragraph";
  children: CustomText[];
};

type HeadingElement = {
  type: "heading";
  level?: number;
  children: CustomText[];
};

type LinkElement = {
  type: "link";
  url: string;
  children: CustomText[];
};

type ListElement = NumberedListElement | BulletedListElement;

type ListItemChild = CustomText | LinkElement | ListElement;

type ListItemElement = {
  type: "list-item";
  children: ListItemChild[];
};

type NumberedListElement = {
  type: "numbered-list";
  children: (ListItemElement | ListElement)[];
};

type BulletedListElement = {
  type: "bulleted-list";
  children: (ListItemElement | ListElement)[];
};

type QuoteElement = {
  type: "quote";
  children: CustomText[];
};

type CodeBlockElement = {
  type: "code";
  children: CustomText[];
};

// Void passthrough node for block types the editor has no UI for (e.g. Strapi
// `image` blocks, or any future block type). We never create these, but we
// render them read-only and round-trip them untouched so nothing is dropped on
// save. See KNOWN_ELEMENT_TYPES / editor.isVoid below.
type VoidPassthroughElement = {
  type: string;
  image?: unknown;
  children: CustomText[];
  [key: string]: unknown;
};

type CustomElement =
  | ParagraphElement
  | HeadingElement
  | LinkElement
  | ListItemElement
  | NumberedListElement
  | BulletedListElement
  | QuoteElement
  | CodeBlockElement
  | VoidPassthroughElement;

// Block types the editor renders and edits directly. Anything else is treated
// as a read-only void passthrough (never dropped, never editable).
const KNOWN_ELEMENT_TYPES = new Set([
  "paragraph",
  "heading",
  "link",
  "list-item",
  "numbered-list",
  "bulleted-list",
  "quote",
  "code",
]);

const isKnownType = (type: string) => KNOWN_ELEMENT_TYPES.has(type);

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// Extend Slate's types
type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

// Helper functions for formatting
const toggleMark = (
  editor: CustomEditor,
  format: keyof Omit<CustomText, "text">
) => {
  const isActive = isMarkActive(editor, format);

  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

const isMarkActive = (
  editor: CustomEditor,
  format: keyof Omit<CustomText, "text">
) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
};

const toggleBlock = (editor: CustomEditor, format: string, level?: number) => {
  // For headings, check if the specific level is active
  const isActive =
    format === "heading" && level
      ? isHeadingActive(editor, level)
      : isBlockActive(editor, format);

  const newProperties: Partial<SlateElement> = {
    type: isActive ? "paragraph" : format,
    ...(format === "heading" && level ? { level } : {}),
  } as Partial<SlateElement>;

  Transforms.setNodes(editor, newProperties, {
    match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n),
  });
};

const toggleList = (
  editor: CustomEditor,
  format: "bulleted-list" | "numbered-list"
) => {
  const isActive = isBlockActive(editor, format);

  Transforms.unwrapNodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) &&
      ["bulleted-list", "numbered-list"].includes((n as CustomElement).type),
    split: true,
  });

  Transforms.setNodes(editor, {
    type: isActive ? "paragraph" : "list-item",
  } as Partial<SlateElement>);

  if (!isActive) {
    const block = { type: format, children: [] } as CustomElement;
    Transforms.wrapNodes(editor, block);
  }
};

// Indent the current list item one level: wrap it in a new list of the same
// format as its parent list. This produces Strapi's nested-list shape, where a
// nested `list` sits among its parent list's children (a sibling of list-items).
const indentListItem = (editor: CustomEditor) => {
  const [entry] = Array.from(
    Editor.nodes(editor, {
      match: (n) =>
        SlateElement.isElement(n) && (n as CustomElement).type === "list-item",
      mode: "lowest",
    })
  );
  if (!entry) return;

  const [, path] = entry;
  const parentPath = Path.parent(path);
  const parent = SlateNode.get(editor, parentPath) as CustomElement;
  const format =
    parent.type === "numbered-list" ? "numbered-list" : "bulleted-list";

  Transforms.wrapNodes(
    editor,
    { type: format, children: [] } as CustomElement,
    {
      match: (n) =>
        SlateElement.isElement(n) && (n as CustomElement).type === "list-item",
      mode: "lowest",
    }
  );
};

// Outdent: unwrap the innermost list wrapping the current list item, promoting
// it one level up (or out of the list entirely at the top level).
const outdentListItem = (editor: CustomEditor) => {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) &&
      ["numbered-list", "bulleted-list"].includes((n as CustomElement).type),
    split: true,
    mode: "lowest",
  });
};

const isBlockActive = (editor: CustomEditor, format: string) => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) =>
        SlateElement.isElement(n) && (n as CustomElement).type === format,
    })
  );

  return !!match;
};

const isHeadingActive = (editor: CustomEditor, level: number) => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) =>
        SlateElement.isElement(n) &&
        (n as CustomElement).type === "heading" &&
        (n as HeadingElement).level === level,
    })
  );

  return !!match;
};

const isLinkActive = (editor: CustomEditor) => {
  const [link] = Array.from(
    Editor.nodes(editor, {
      match: (n) =>
        SlateElement.isElement(n) && (n as CustomElement).type === "link",
    })
  );
  return !!link;
};

const insertLink = (editor: CustomEditor, url: string, text?: string) => {
  wrapLink(editor, url, text);
};

const wrapLink = (editor: CustomEditor, url: string, text?: string) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const link: LinkElement = {
    type: "link",
    url,
    // With no selection we insert the link text the user typed (falling back to
    // the URL); with a selection we wrap the existing text instead.
    children: isCollapsed ? [{ text: text || url }] : [],
  };

  if (isCollapsed) {
    // Insert the link followed by an empty text node. insertNodes leaves the
    // cursor at the end of the inserted content — i.e. in that trailing text
    // node, *outside* the link — so continued typing and Enter are not absorbed
    // into the link.
    Transforms.insertNodes(editor, [link, { text: "" }]);
  } else {
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: "end" });
  }
};

const unwrapLink = (editor: CustomEditor) => {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) && (n as CustomElement).type === "link",
  });
};

const toggleLink = (editor: CustomEditor) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
    return;
  }

  // Capture the selection before prompting — window.prompt blurs the editor and
  // drops the DOM selection, and a fresh field may have no selection at all,
  // either of which would make the insert a silent no-op.
  const savedSelection = editor.selection;

  const url = window.prompt("Link URL:");
  if (!url) return;

  const isCollapsed = !savedSelection || Range.isCollapsed(savedSelection);
  // When there's no selection to wrap, ask for the text to display (defaulting
  // to the URL). With a selection, the selected text becomes the link text.
  const text = isCollapsed
    ? window.prompt("Link text:", url) || url
    : undefined;

  // Restore the pre-prompt selection (or fall back to the end of the document
  // when the editor was never focused) so the link lands somewhere valid.
  ReactEditor.focus(editor);
  Transforms.select(editor, savedSelection ?? Editor.end(editor, []));

  insertLink(editor, url, text);
};

// Render leaf (for text formatting like bold, italic, underline, etc.)
const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  let styledChildren = children;
  const customLeaf = leaf as CustomText;

  if (customLeaf.bold) {
    styledChildren = <strong>{styledChildren}</strong>;
  }

  if (customLeaf.italic) {
    styledChildren = <em>{styledChildren}</em>;
  }

  if (customLeaf.underline) {
    styledChildren = <u>{styledChildren}</u>;
  }

  if (customLeaf.strikethrough) {
    styledChildren = <s>{styledChildren}</s>;
  }

  if (customLeaf.code) {
    styledChildren = <code>{styledChildren}</code>;
  }

  return <span {...attributes}>{styledChildren}</span>;
};

// Render element (for block types like paragraph, heading, lists, etc.)
const Element = ({ attributes, children, element }: RenderElementProps) => {
  const customElement = element as CustomElement;

  switch (customElement.type) {
    case "heading":
      const level = (customElement as HeadingElement).level || 3;
      switch (level) {
        case 1:
          return <h1 {...attributes}>{children}</h1>;
        case 2:
          return <h2 {...attributes}>{children}</h2>;
        case 3:
          return <h3 {...attributes}>{children}</h3>;
        case 4:
          return <h4 {...attributes}>{children}</h4>;
        case 5:
          return <h5 {...attributes}>{children}</h5>;
        case 6:
          return <h6 {...attributes}>{children}</h6>;
        default:
          return <h3 {...attributes}>{children}</h3>;
      }
    case "quote":
      return <blockquote {...attributes}>{children}</blockquote>;
    case "code":
      return (
        <pre {...attributes}>
          <code>{children}</code>
        </pre>
      );
    case "bulleted-list":
      return <ul {...attributes}>{children}</ul>;
    case "numbered-list":
      return <ol {...attributes}>{children}</ol>;
    case "list-item":
      return <li {...attributes}>{children}</li>;
    case "link":
      return (
        <a
          {...attributes}
          className="slate-editor-link"
          href={(customElement as LinkElement).url}
        >
          {children}
        </a>
      );
    case "paragraph":
      return <p {...attributes}>{children}</p>;
    default: {
      // Unknown block type (e.g. a Strapi `image` block) — render read-only so
      // it's visible and never silently dropped. Slate still requires that we
      // render `attributes` and `children` even for void nodes.
      const image = (customElement as VoidPassthroughElement).image as
        | { url?: string; alternativeText?: string | null }
        | undefined;
      return (
        <div {...attributes} className="slate-editor-void">
          <div contentEditable={false}>
            {customElement.type === "image" && image?.url ? (
              <img
                src={image.url}
                alt={image.alternativeText || ""}
                style={{ maxWidth: "100%" }}
              />
            ) : (
              <span className="slate-editor-void-label">
                [{customElement.type}]
              </span>
            )}
          </div>
          {children}
        </div>
      );
    }
  }
};

// Toolbar button component
const ToolbarButton = ({
  active,
  onMouseDown,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) => {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      disabled={disabled}
      title={title}
      className={`slate-editor-toolbar-button ${active ? "active" : ""}`}
    >
      {children}
    </button>
  );
};

// Toolbar component
const Toolbar = ({
  editor,
  disabled,
  showHistory = true,
  showHeadings = true,
}: {
  editor: CustomEditor;
  disabled?: boolean;
  showHistory?: boolean;
  showHeadings?: boolean;
}) => {
  return (
    <div className="slate-editor-toolbar">
      {showHistory && (
        <>
          {/* Undo/Redo */}
          <ToolbarButton
            active={false}
            disabled={disabled}
            title="undo (ctrl+z)"
            onMouseDown={(event) => {
              event.preventDefault();
              editor.undo();
            }}
          >
            <ArrowCounterClockwiseIcon size={16} weight="bold" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            disabled={disabled}
            title="redo (ctrl+shift+z)"
            onMouseDown={(event) => {
              event.preventDefault();
              editor.redo();
            }}
          >
            <ArrowClockwiseIcon size={16} weight="bold" />
          </ToolbarButton>

          <span className="slate-editor-toolbar-separator" />
        </>
      )}

      {/* Text formatting marks */}
      <ToolbarButton
        active={isMarkActive(editor, "bold")}
        disabled={disabled}
        title="bold (ctrl+b)"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleMark(editor, "bold");
        }}
      >
        <TextBIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isMarkActive(editor, "italic")}
        disabled={disabled}
        title="italic (ctrl+i)"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleMark(editor, "italic");
        }}
      >
        <TextItalicIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isMarkActive(editor, "underline")}
        disabled={disabled}
        title="underline (ctrl+u)"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleMark(editor, "underline");
        }}
      >
        <TextUnderlineIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isMarkActive(editor, "strikethrough")}
        disabled={disabled}
        title="strikethrough"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleMark(editor, "strikethrough");
        }}
      >
        <TextStrikethroughIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isMarkActive(editor, "code")}
        disabled={disabled}
        title="inline code"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleMark(editor, "code");
        }}
      >
        <CodeSimpleIcon size={16} weight="bold" />
      </ToolbarButton>

      {/* Link */}
      <ToolbarButton
        active={isLinkActive(editor)}
        disabled={disabled}
        title="insert link (ctrl+k)"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleLink(editor);
        }}
      >
        <LinkIcon size={16} weight="bold" />
      </ToolbarButton>

      <span className="slate-editor-toolbar-separator" />

      {/* Lists and blocks */}
      <ToolbarButton
        active={isBlockActive(editor, "bulleted-list")}
        disabled={disabled}
        title="bulleted list"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleList(editor, "bulleted-list");
        }}
      >
        <ListBulletsIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isBlockActive(editor, "numbered-list")}
        disabled={disabled}
        title="numbered list"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleList(editor, "numbered-list");
        }}
      >
        <ListNumbersIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isBlockActive(editor, "quote")}
        disabled={disabled}
        title="quote"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "quote");
        }}
      >
        <QuotesIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isBlockActive(editor, "code")}
        disabled={disabled}
        title="code block"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "code");
        }}
      >
        <CodeBlockIcon size={16} weight="bold" />
      </ToolbarButton>

      {showHeadings && (
        <>
      <span className="slate-editor-toolbar-separator" />

      {/* Headings */}
      <ToolbarButton
        active={isHeadingActive(editor, 1)}
        disabled={disabled}
        title="heading 1"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "heading", 1);
        }}
      >
        <TextHOneIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isHeadingActive(editor, 2)}
        disabled={disabled}
        title="heading 2"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "heading", 2);
        }}
      >
        <TextHTwoIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isHeadingActive(editor, 3)}
        disabled={disabled}
        title="heading 3"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "heading", 3);
        }}
      >
        <TextHThreeIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isHeadingActive(editor, 4)}
        disabled={disabled}
        title="heading 4"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "heading", 4);
        }}
      >
        <TextHFourIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isHeadingActive(editor, 5)}
        disabled={disabled}
        title="heading 5"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "heading", 5);
        }}
      >
        <TextHFiveIcon size={16} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        active={isHeadingActive(editor, 6)}
        disabled={disabled}
        title="heading 6"
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, "heading", 6);
        }}
      >
        <TextHSixIcon size={16} weight="bold" />
      </ToolbarButton>
        </>
      )}
    </div>
  );
};

export default function SlateEditor({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  showHistory = true,
  showHeadings = true,
}: SlateEditorProps) {
  const editor = useMemo(() => {
    const e = withHistory(withReact(createEditor()));

    // Override isInline to treat links as inline elements
    const { isInline, isVoid } = e;
    e.isInline = (element) => {
      return (element as CustomElement).type === "link"
        ? true
        : isInline(element);
    };

    // Treat any block type we don't have UI for (e.g. Strapi `image`) as a
    // read-only void node, so it renders atomically and round-trips untouched
    // instead of being corrupted or dropped.
    e.isVoid = (element) => {
      const type = (element as CustomElement).type;
      return isKnownType(type) ? isVoid(element) : true;
    };

    return e;
  }, []);

  const slateValue = useMemo(() => blocksContentToSlateValue(value), [value]);

  // Update editor content when the value prop changes (e.g. switching records).
  // The equality guard means normal typing — where the parent value echoes back
  // what we just emitted — never triggers a reset. We clear the selection first
  // so it can't dangle on nodes that no longer exist after the swap.
  useEffect(() => {
    const newValue = blocksContentToSlateValue(value);
    const isEqual =
      JSON.stringify(editor.children) === JSON.stringify(newValue);

    if (!isEqual) {
      editor.selection = null;
      editor.children = newValue;
      editor.onChange();
    }
  }, [value, editor]);

  const handleChange = useCallback(
    (newValue: Descendant[]) => {
      const isAstChange = editor.operations.some(
        (op) => op.type !== "set_selection"
      );
      if (isAstChange) {
        const blocksContent = slateValueToBlocksContent(newValue);
        onChange(blocksContent);
      }
    },
    [editor.operations, onChange]
  );

  const renderLeaf = useCallback(
    (props: RenderLeafProps) => <Leaf {...props} />,
    []
  );
  const renderElement = useCallback(
    (props: RenderElementProps) => <Element {...props} />,
    []
  );

  // Keyboard shortcuts for formatting
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      // Handle Shift+Enter for soft line breaks
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        editor.insertText("\n");
        return;
      }

      // Tab / Shift+Tab indent-outdent list items into nested lists
      if (event.key === "Tab" && isBlockActive(editor, "list-item")) {
        event.preventDefault();
        if (event.shiftKey) {
          outdentListItem(editor);
        } else {
          indentListItem(editor);
        }
        return;
      }

      // Enter on an *empty* list item exits the list: turn the item into a
      // paragraph and lift it out. (A non-empty item keeps Slate's default of
      // splitting into a new list item.)
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        isBlockActive(editor, "list-item")
      ) {
        const { selection } = editor;
        if (selection && Range.isCollapsed(selection)) {
          const [entry] = Array.from(
            Editor.nodes(editor, {
              match: (n) =>
                SlateElement.isElement(n) &&
                (n as CustomElement).type === "list-item",
              mode: "lowest",
            })
          );
          if (entry && Editor.string(editor, entry[1]) === "") {
            event.preventDefault();
            Transforms.setNodes(editor, { type: "paragraph" } as Partial<
              SlateElement
            >, {
              match: (n) =>
                SlateElement.isElement(n) &&
                (n as CustomElement).type === "list-item",
            });
            Transforms.unwrapNodes(editor, {
              match: (n) =>
                SlateElement.isElement(n) &&
                ["numbered-list", "bulleted-list"].includes(
                  (n as CustomElement).type
                ),
              split: true,
              mode: "lowest",
            });
            return;
          }
        }
      }

      // Enter inside a quote or code block inserts a newline *within* the same
      // block (so a multi-line quote/code stays a single Strapi block). A second
      // Enter on an empty trailing line — or on a wholly empty block — exits to
      // a paragraph instead (double-enter to escape).
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        (isBlockActive(editor, "quote") || isBlockActive(editor, "code"))
      ) {
        const { selection } = editor;
        if (selection && Range.isCollapsed(selection)) {
          const [entry] = Array.from(
            Editor.nodes(editor, {
              match: (n) =>
                SlateElement.isElement(n) &&
                ["quote", "code"].includes((n as CustomElement).type),
              mode: "lowest",
            })
          );
          if (entry) {
            const [, path] = entry;
            const text = Editor.string(editor, path);
            const atEnd = Editor.isEnd(editor, selection.anchor, path);
            event.preventDefault();
            if (text === "") {
              // Wholly empty block → become a paragraph in place.
              Transforms.setNodes(
                editor,
                { type: "paragraph" } as Partial<SlateElement>,
                {
                  match: (n) =>
                    SlateElement.isElement(n) &&
                    ["quote", "code"].includes((n as CustomElement).type),
                }
              );
            } else if (atEnd && text.endsWith("\n")) {
              // Empty trailing line → drop it and start a paragraph after.
              Transforms.delete(editor, { unit: "character", reverse: true });
              Transforms.insertNodes(
                editor,
                {
                  type: "paragraph",
                  children: [{ text: "" }],
                } as CustomElement,
                { at: Path.next(path), select: true }
              );
            } else {
              // Otherwise: a newline within the same block.
              editor.insertText("\n");
            }
            return;
          }
        }
      }

      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      switch (event.key) {
        case "z": {
          event.preventDefault();
          if (event.shiftKey) {
            editor.redo();
          } else {
            editor.undo();
          }
          break;
        }
        case "b": {
          event.preventDefault();
          toggleMark(editor as CustomEditor, "bold");
          break;
        }
        case "i": {
          event.preventDefault();
          toggleMark(editor as CustomEditor, "italic");
          break;
        }
        case "u": {
          event.preventDefault();
          toggleMark(editor as CustomEditor, "underline");
          break;
        }
        case "k": {
          event.preventDefault();
          toggleLink(editor as CustomEditor);
          break;
        }
      }
    },
    [editor, disabled]
  );

  return (
    <div className="slate-editor-container">
      <Slate editor={editor} initialValue={slateValue} onChange={handleChange}>
        <Toolbar
          editor={editor}
          disabled={disabled}
          showHistory={showHistory}
          showHeadings={showHeadings}
        />
        <Editable
          className="slate-editor-editable"
          renderLeaf={renderLeaf}
          renderElement={renderElement}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          readOnly={disabled}
        />
      </Slate>
    </div>
  );
}
