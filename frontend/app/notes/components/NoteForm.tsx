"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import type { Note, StrapiBlock } from "@/app/types/admin";
import RichTextEditor from "@/app/components/admin/RichTextEditor";

const schema = z.object({
  text: z.array(z.any()).min(1, "Text is required"),
  noteCategory: z.string().optional(),
  context: z.string().optional(),
});

type NoteFormInputs = z.infer<typeof schema>;

interface NoteFormProps {
  note?: Note;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function NoteForm({ note, onSubmit, onCancel }: NoteFormProps) {
  const [text, setText] = useState<StrapiBlock[]>(
    note?.text || [{ type: "paragraph", children: [{ type: "text", text: "" }] }]
  );
  const [noteCategorySuggestions, setNoteCategorySuggestions] = useState<string[]>([]);
  const [noteCategoryInput, setNoteCategoryInput] = useState<string>(
    note?.noteCategory || ""
  );
  const [showNoteCategorySuggestions, setShowNoteCategorySuggestions] = useState(false);
  const [contextInput, setContextInput] = useState<string>(note?.context || "");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<NoteFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      text: note?.text || [],
      noteCategory: note?.noteCategory || "",
      context: note?.context || "",
    },
  });

  // Update form when note changes (for editing)
  useEffect(() => {
    if (note) {
      setText(note.text);
      setNoteCategoryInput(note.noteCategory);
      setContextInput(note.context || "");
      setValue("text", note.text);
      setValue("noteCategory", note.noteCategory);
      setValue("context", note.context || "");
    }
  }, [note, setValue]);

  // Fetch note category suggestions
  useEffect(() => {
    fetchNoteCategorySuggestions();
  }, []);

  const fetchNoteCategorySuggestions = async () => {
    try {
      const response = await fetch("/api/notes");
      const result = await response.json();
      if (result.success) {
        const allNotes: Note[] = result.data;
        // Get unique, non-null noteCategory values
        const categories = new Set<string>();
        allNotes.forEach((note) => {
          if (note.noteCategory) {
            categories.add(note.noteCategory.trim());
          }
        });
        setNoteCategorySuggestions(Array.from(categories).sort());
      }
    } catch (error) {
      console.error("Error fetching note category suggestions:", error);
    }
  };

  // Filter suggestions based on input
  const filteredNoteCategorySuggestions = noteCategoryInput
    ? noteCategorySuggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(noteCategoryInput.toLowerCase())
      )
    : noteCategorySuggestions;

  const handleFormSubmit: SubmitHandler<NoteFormInputs> = (data) => {
    // Trim empty paragraphs from beginning and end
    let trimmedText = [...text];
    
    // Helper to check if block is empty
    const isEmptyBlock = (block: StrapiBlock) => {
      if (block.type === 'paragraph') {
        if (!block.children || block.children.length === 0) return true;
        return block.children.every(child => 
          child.type === 'text' && (!child.text || child.text.trim() === '')
        );
      }
      return false;
    };
    
    // Remove empty paragraphs from beginning
    while (trimmedText.length > 1 && isEmptyBlock(trimmedText[0])) {
      trimmedText.shift();
    }
    
    // Remove empty paragraphs from end
    while (trimmedText.length > 1 && isEmptyBlock(trimmedText[trimmedText.length - 1])) {
      trimmedText.pop();
    }
    
    onSubmit({
      text: trimmedText,
      noteCategory: data.noteCategory,
      context: data.context,
    });
  };

  const handleTextChange = (newText: StrapiBlock[]) => {
    setText(newText);
    setValue("text", newText);
  };

  return (
    <form className="todo-form" onSubmit={handleSubmit(handleFormSubmit)}>
      <h3>{note ? "edit note" : "new note"}</h3>

      <div className="todo-form-element">
        <label htmlFor="noteCategory">category</label>
        <input
          id="noteCategory"
          type="text"
          placeholder="category"
          value={noteCategoryInput}
          {...register("noteCategory")}
          onChange={(e) => {
            const value = e.target.value;
            setNoteCategoryInput(value);
            setValue("noteCategory", value);
            setShowNoteCategorySuggestions(true);
          }}
          onFocus={() => setShowNoteCategorySuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowNoteCategorySuggestions(false), 200);
          }}
        />
        {showNoteCategorySuggestions &&
          filteredNoteCategorySuggestions.length > 0 && (
            <ul className="wishListCategory-autocomplete">
              {filteredNoteCategorySuggestions.map((suggestion) => (
                <li
                  key={suggestion}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setNoteCategoryInput(suggestion);
                    setValue("noteCategory", suggestion);
                    setShowNoteCategorySuggestions(false);
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        {errors.noteCategory && (
          <span className="error">{errors.noteCategory.message}</span>
        )}
      </div>

      <div className="todo-form-element">
        <label htmlFor="context">context</label>
        <input
          id="context"
          type="text"
          placeholder="context"
          value={contextInput}
          {...register("context")}
          onChange={(e) => {
            const value = e.target.value;
            setContextInput(value);
            setValue("context", value);
          }}
        />
        {errors.context && (
          <span className="error">{errors.context.message}</span>
        )}
      </div>

      <div className="todo-form-element">
        <label htmlFor="text">text</label>
        <RichTextEditor value={text} onChange={handleTextChange} />
        {errors.text && <span className="error">{errors.text.message}</span>}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {note ? "edit note" : "create note"}
        </button>
      </div>
    </form>
  );
}

