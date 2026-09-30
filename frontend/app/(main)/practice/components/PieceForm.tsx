"use client";

import { useMemo, useState } from "react";
import Button from "@/app/components/ui/Button";
import { Field, Input, Radio, Select } from "@/app/components/ui/FormControls";
import RichTextEditor from "@/app/components/ui/RichTextEditor";
import { useProjects } from "@/app/hooks/useProjects";
import { useTasks } from "@/app/(main)/(todo)/hooks/useTasks";
import { isPracticeWorld } from "@/app/lib/worlds";
import type { StrapiBlock, Task } from "@/app/types/index";

/**
 * Where a piece is: the four places the practice page lists it under.
 *
 * Each is a combination of flags the task already has, not a field of its own.
 * `soon` is the rotation, as it is for every task; `onHold` is set aside;
 * `completed` is learned, which for a study subject is simply done. Pulling a
 * piece back from learned is un-completing it.
 */
export type PiecePlace = "rotation" | "shelf" | "hold" | "learned";

export const PIECE_PLACES: { value: PiecePlace; label: string }[] = [
  { value: "rotation", label: "in rotation" },
  { value: "shelf", label: "on the shelf" },
  { value: "hold", label: "on hold" },
  { value: "learned", label: "learned" },
];

export function placeOf(task: Pick<Task, "soon" | "onHold" | "completed">): PiecePlace {
  if (task.completed) return "learned";
  if (task.onHold) return "hold";
  return task.soon ? "rotation" : "shelf";
}

/**
 * The flags that put a piece in `place`. All three are always written, so moving
 * a piece never leaves a stale flag behind: a piece taken off hold into rotation
 * is not still on hold underneath. `completedAt` keeps its first date while the
 * piece stays learned, and clears when it comes back.
 */
export function flagsFor(
  place: PiecePlace,
  current?: Pick<Task, "completed" | "completedAt">,
): Pick<Task, "soon" | "onHold" | "completed" | "completedAt"> {
  const learned = place === "learned";
  return {
    soon: place === "rotation",
    onHold: place === "hold",
    completed: learned,
    completedAt: learned
      ? current?.completed && current.completedAt
        ? current.completedAt
        : new Date().toISOString()
      : null,
  };
}

interface PieceFormProps {
  /** The piece being edited; absent for a new one. */
  piece?: Task;
  /** The subject a new piece starts under, e.g. the one the practice page shows. */
  subjectId?: string | null;
  onSubmit: (payload: Record<string, unknown>) => void;
  /** Absent for a new piece, which has nothing to delete. */
  onDelete?: () => void;
}

/**
 * Add or edit a piece of practice material.
 *
 * Its own form rather than the task form with fields hidden: a piece has no
 * dates, recurrence or soon/long checkboxes, and does have a place (rotation,
 * shelf, on hold, learned) that the task form has no way to say.
 */
export default function PieceForm({ piece, subjectId, onSubmit, onDelete }: PieceFormProps) {
  const { projects } = useProjects();
  const { tasks } = useTasks();

  const subjects = useMemo(
    () =>
      projects
        .filter((p) => isPracticeWorld(p.world) && !p.complete)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [projects],
  );

  const [title, setTitle] = useState(piece?.title ?? "");
  const [subject, setSubject] = useState<string>(
    piece?.project?.documentId ?? subjectId ?? subjects[0]?.documentId ?? "",
  );
  const [category, setCategory] = useState(piece?.materialCategory ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notes, setNotes] = useState<StrapiBlock[]>(piece?.description ?? []);
  const [place, setPlace] = useState<PiecePlace>(piece ? placeOf(piece) : "rotation");
  const [titleError, setTitleError] = useState<string | undefined>();

  // Categories already used within this subject: the vocabulary is per subject,
  // so "scales" under guitar isn't offered while filling in ear training.
  const suggestions = useMemo(() => {
    const used = new Set<string>();
    for (const t of tasks) {
      if (t.project?.documentId === subject && t.materialCategory) {
        used.add(t.materialCategory.trim());
      }
    }
    const typed = category.trim().toLowerCase();
    return Array.from(used)
      .sort()
      .filter((c) => !typed || c.toLowerCase().includes(typed));
  }, [tasks, subject, category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("a piece needs a name");
      return;
    }
    onSubmit({
      title: title.trim(),
      project: subject || null,
      materialCategory: category.trim() || null,
      description: notes,
      ...flagsFor(place, piece),
    });
  };

  return (
    <form className="flex flex-col gap-fields text-left" onSubmit={handleSubmit}>
      <Field label="name" htmlFor="piece-name" error={titleError}>
        <Input
          id="piece-name"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(undefined);
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-fields">
        <Field label="subject" htmlFor="piece-subject">
          <Select
            id="piece-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="category" htmlFor="piece-category">
          <Input
            id="piece-category"
            type="text"
            autoComplete="off"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            // Late enough that a click on a suggestion lands first.
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full right-0 left-0 z-50 max-h-[200px] overflow-y-auto rounded-b-lg border border-base-content bg-base-300 text-base-content">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion}
                  className="cursor-pointer px-3 py-2 hover:bg-base-200"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCategory(suggestion);
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>

      <Field label="notes" htmlFor="piece-notes">
        <RichTextEditor value={notes} onChange={setNotes} placeholder="notes" />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-small">where it is</legend>
        {PIECE_PLACES.map(({ value, label }) => (
          <Radio
            key={value}
            name="piece-place"
            value={value}
            checked={place === value}
            onChange={() => setPlace(value)}
          >
            {label}
          </Radio>
        ))}
      </fieldset>

      <div className="text-center">
        <Button type="submit">{piece ? "update" : "create"} piece</Button>
      </div>

      {onDelete && (
        <div className="mt-8 border-t border-base-content/30 pt-8 text-center">
          <Button onClick={onDelete}>delete</Button>
        </div>
      )}
    </form>
  );
}
