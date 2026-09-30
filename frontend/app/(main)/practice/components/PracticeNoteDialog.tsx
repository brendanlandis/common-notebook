'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Button from '@/app/components/ui/Button';
import { Input, Textarea } from '@/app/components/ui/FormControls';
import { usePracticeNotes } from '@/app/(main)/practice/hooks/usePracticeSession';

/** The stretch a note is about: one piece, in one session. */
export interface NotePiece {
  /** The practice-log documentId. */
  log: string;
  title: string;
  minutes: number;
  tempo?: number | null;
  goalTempo?: number | null;
}

type NoteDialogProps =
  | {
      /** Switching pieces: a note on the one being left. The clock is already on the next. */
      mode: 'switch';
      piece: NotePiece;
      next: string;
      onDone: () => void;
    }
  | {
      /** After stop: a note on the last piece, and one on the whole session. */
      mode: 'stop';
      piece: NotePiece;
      earlier: { title: string; minutes: number }[];
      session: string | null;
      onDone: () => void;
    };

const minutesLabel = (m: number) => `${m} min`;

/**
 * What you write between pieces and at the end: how the piece went, and the
 * tempo reached if it has a tempo. Skippable, always — a note nobody wanted to
 * write is worse than none.
 *
 * Notes are per piece, per session ("today this piece was…"). Stopping adds one
 * on the session as a whole, under a line for each piece that came before.
 */
export default function PracticeNoteDialog(props: NoteDialogProps) {
  const { piece, onDone } = props;
  const { saveNote, saveSessionNote } = usePracticeNotes();
  const hasTempo = piece.tempo != null || piece.goalTempo != null;

  const [note, setNote] = useState('');
  const [tempo, setTempo] = useState(piece.tempo != null ? String(piece.tempo) : '');
  const [sessionNote, setSessionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const total =
    props.mode === 'stop'
      ? props.earlier.reduce((sum, p) => sum + p.minutes, piece.minutes)
      : piece.minutes;

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      const reached = Math.round(Number(tempo));
      await saveNote(piece.log, {
        notes: note,
        ...(hasTempo && tempo.trim() && reached > 0 ? { tempoReached: reached } : {}),
      });
      if (props.mode === 'stop' && props.session && sessionNote.trim()) {
        await saveSessionNote(props.session, sessionNote);
      }
      onDone();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-black/55 p-4">
          <Dialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              if (!saving) onDone();
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            className="flex w-full max-w-104 flex-col gap-sections rounded-2xl bg-base-100 px-6 py-8 shadow-[0_1.5rem_3rem_rgb(0_0_0/0.35)]"
          >
            {props.mode === 'switch' ? (
              <div className="flex flex-col items-center gap-heading text-center">
                <Dialog.Title className="m-0">{piece.title}</Dialog.Title>
                <p className="m-0 opacity-80">{minutesLabel(piece.minutes)}</p>
              </div>
            ) : (
              <>
                <Dialog.Title className="m-0 text-center">{total} minutes</Dialog.Title>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {props.earlier.map((p, i) => (
                    <li key={`${p.title}-${i}`} className="flex items-baseline gap-2 opacity-80">
                      <span className="grow">{p.title}</span>
                      <span className="tabular-nums">{minutesLabel(p.minutes)}</span>
                    </li>
                  ))}
                  <li className="flex items-baseline gap-2">
                    <span className="grow font-bold">{piece.title}</span>
                    <span className="tabular-nums opacity-80">{minutesLabel(piece.minutes)}</span>
                  </li>
                </ul>
              </>
            )}

            <div className="flex flex-col gap-fields">
              {hasTempo && (
                <div className="flex items-center gap-2 text-small">
                  <label htmlFor="tempo-reached">tempo reached</label>
                  <Input
                    id="tempo-reached"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    fullWidth={false}
                    style={{ width: '5.5rem' }}
                    value={tempo}
                    onChange={(e) => setTempo(e.target.value)}
                  />
                  <span className="opacity-80">
                    bpm{piece.goalTempo != null ? ` · goal ${piece.goalTempo}` : ''}
                  </span>
                </div>
              )}
              <div>
                <label htmlFor="piece-note" className="mb-1 block text-small">
                  note
                </label>
                <Textarea
                  id="piece-note"
                  rows={3}
                  placeholder="how did it go?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              {props.mode === 'stop' && (
                <div className="border-t border-base-content/30 pt-4">
                  <label htmlFor="session-note" className="mb-1 block text-small">
                    note
                  </label>
                  <Textarea
                    id="session-note"
                    // Every note is labeled "note"; this one, under the rule, is the
                    // whole session's, and says so to a screen reader.
                    aria-label="note on the whole session"
                    rows={2}
                    value={sessionNote}
                    onChange={(e) => setSessionNote(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-rows">
              {props.mode === 'switch' && (
                <p className="m-0 text-small opacity-80">next: {props.next}</p>
              )}
              {failed && <p className="m-0 text-small italic">couldn&apos;t save that; try again</p>}
              <div className="flex gap-controls">
                <Button onClick={save} disabled={saving}>
                  {props.mode === 'switch' ? 'save and switch' : 'save'}
                </Button>
                <Button onClick={onDone} disabled={saving}>
                  skip
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
