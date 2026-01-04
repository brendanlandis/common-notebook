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
  Code,
  ListBullets,
  ListNumbers,
  Link as LinkIcon,
  Quotes,
  TextHOne,
  TextHTwo,
  TextHThree,
  TextHFour,
  TextHFive,
  TextHSix,
} from '@phosphor-icons/react';

interface NotesEditorProps {
  value: StrapiBlock[];
  onChange: (blocks: StrapiBlock[]) => void;
}

export default function NotesEditor({ value, onChange }: NotesEditorProps) {
  const isInternalUpdate = useRef(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: false,
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
    content: strapiBlocksToTiptap(value),
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      const json = editor.getJSON();
      const strapiBlocks = tiptapToStrapiBlocks(json);
      onChange(strapiBlocks);
    },
    editorProps: {
      attributes: {
        class: 'practice-notes-content',
      },
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
    if (editor && value) {
      if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return;
      }
      
      const currentJson = editor.getJSON();
      const newJson = strapiBlocksToTiptap(value);
      
      if (JSON.stringify(currentJson) !== JSON.stringify(newJson)) {
        editor.commands.setContent(newJson);
      }
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="practice-notes-editor">
      <div className="practice-notes-toolbar flex gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
          aria-label="Heading 1"
        >
          <TextHOne size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
          aria-label="Heading 2"
        >
          <TextHTwo size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
          aria-label="Heading 3"
        >
          <TextHThree size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={editor.isActive('heading', { level: 4 }) ? 'is-active' : ''}
          aria-label="Heading 4"
        >
          <TextHFour size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
          className={editor.isActive('heading', { level: 5 }) ? 'is-active' : ''}
          aria-label="Heading 5"
        >
          <TextHFive size={18} weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
          className={editor.isActive('heading', { level: 6 }) ? 'is-active' : ''}
          aria-label="Heading 6"
        >
          <TextHSix size={18} weight="regular" />
        </button>
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
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'is-active' : ''}
          aria-label="Code"
        >
          <Code size={18} weight="regular" />
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
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''}
          aria-label="Quote"
        >
          <Quotes size={18} weight="regular" />
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
        <div className="practice-notes-link-input flex gap-1 items-center">
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
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleLinkSubmit}
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl('');
            }}
          >
            Cancel
          </button>
        </div>
      )}
      
      <EditorContent editor={editor} />
    </div>
  );
}

