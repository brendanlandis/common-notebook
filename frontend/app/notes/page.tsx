"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Note } from "@/app/types/admin";
import FaviconManager from "@/app/components/FaviconManager";
import NoteForm from "./components/NoteForm";
import NoteItem from "./components/NoteItem";
import { useTodoActions } from "@/app/contexts/TodoActionsContext";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [drawerContainer, setDrawerContainer] = useState<HTMLElement | null>(
    null
  );
  const { drawerContent, closeDrawer } = useTodoActions();

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    // Find the drawer container after mount
    setDrawerContainer(document.getElementById("drawer-form-container"));
  }, []);

  // Reset editing state when drawer closes
  useEffect(() => {
    if (drawerContent === null) {
      setEditingNote(null);
    }
  }, [drawerContent]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/notes");
      const result = await response.json();

      if (result.success) {
        setNotes(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to fetch notes");
      console.error("Error fetching notes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingNote) {
        // Update existing note
        const response = await fetch(`/api/notes/${editingNote.documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          await fetchNotes();
          closeDrawer();
        }
      } else {
        // Create new note
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await fetchNotes();
            closeDrawer();
          }
        }
      }
    } catch (err) {
      console.error("Error saving note:", err);
      setError("Failed to save note");
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    // Drawer will be opened by the NoteItem component calling useTodoActions
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/notes/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchNotes();
      }
    } catch (err) {
      console.error("Error deleting note:", err);
      setError("Failed to delete note");
    }
  };

  if (loading) {
    return (
      <>
        <FaviconManager type="pencil" />
        <main id="admin-notes">
          <p>loading...</p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <FaviconManager type="pencil" />
        <main id="admin-notes">
          <p>error: {error}</p>
        </main>
      </>
    );
  }

  // Group notes by category for display
  const notesByCategory = notes.reduce((acc, note) => {
    const category = note.noteCategory;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  return (
    <>
      <FaviconManager type="pencil" />
      <main id="admin-notes">
        {notes.length === 0 ? (
          <p>no notes found</p>
        ) : (
          <div className="notes-container">
            {Object.entries(notesByCategory)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, categoryNotes]) => (
                <div key={category} className="notes-section">
                  <h3>{category}</h3>
                  <ul className="notes-list">
                    {categoryNotes.map((note) => (
                      <NoteItem
                        key={note.documentId}
                        note={note}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}

        {drawerContainer &&
          drawerContent === "note" &&
          createPortal(
            <NoteForm
              key={editingNote?.documentId || "new"}
              note={editingNote || undefined}
              onSubmit={handleSubmit}
              onCancel={closeDrawer}
            />,
            drawerContainer
          )}
      </main>
    </>
  );
}
