'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { StrapiBlock } from '@/app/types/admin';
import { strapiBlocksToTiptap, tiptapToStrapiBlocks } from '@/app/lib/strapiBlocksConverter';
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  ListBullets,
  ListNumbers,
  Link as LinkIcon,
} from '@phosphor-icons/react';

interface RichTextEditorProps {
  value: StrapiBlock[];
  onChange: (blocks: StrapiBlock[]) => void;
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const isInternalUpdate = useRef(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable features we don't want
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'rich-text-content',
      },
    },
    content: strapiBlocksToTiptap(value),
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      const json = editor.getJSON();
      const strapiBlocks = tiptapToStrapiBlocks(json);
      onChange(strapiBlocks);
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || '');
    setShowLinkInput(true);
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor) return;
    
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (!editor) return;
    
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    
    const newJson = strapiBlocksToTiptap(value);
    const currentJson = editor.getJSON();
    
    // Always update if the content is different
    if (JSON.stringify(currentJson) !== JSON.stringify(newJson)) {
      editor.commands.setContent(newJson);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          aria-label="Bold"
        >
          <TextB size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          aria-label="Italic"
        >
          <TextItalic size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'is-active' : ''}
          aria-label="Underline"
        >
          <TextUnderline size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
          aria-label="Strikethrough"
        >
          <TextStrikethrough size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          aria-label="Bullet List"
        >
          <ListBullets size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          aria-label="Numbered List"
        >
          <ListNumbers size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={setLink}
          className={editor.isActive('link') ? 'is-active' : ''}
          aria-label="Link"
        >
          <LinkIcon size={18} weight="regular" />
        </button>
      </div>
      
      {showLinkInput && (
        <div className="rich-text-link-input">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleLinkSubmit();
              }
              if (e.key === 'Escape') {
                setShowLinkInput(false);
                setLinkUrl('');
              }
            }}
            placeholder="Enter URL"
            autoFocus
          />
          <button
            type="button"
            className="btn"
            onClick={handleLinkSubmit}
          >
            cool
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl('');
            }}
          >
            nevermind
          </button>
        </div>
      )}
      
      <EditorContent editor={editor} />
    </div>
  );
}

