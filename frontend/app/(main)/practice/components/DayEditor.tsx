'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Button from '@/app/components/ui/Button';
import DeleteButton from '@/app/components/ui/DeleteButton';
import { Field, Input, Textarea } from '@/app/components/ui/FormControls';
import { apiSend } from '@/app/lib/apiFetch';
import { noteBlocks } from '@/app/lib/practiceSession';
import { usePracticeLogs } from '@/app/(main)/practice/hooks/usePracticeLogs';
import { usePracticeSessions } from '@/app/(main)/practice/hooks/usePracticePage';
import { blocksText } from '@/app/(main)/practice/lib/history';
import type { PracticeLog, PracticeSession } from '@/app/types/index';

/** One sitting on the day, or the stretches of one subject from before sessions. */
interface Group {
  key: string;
  title: string;
  session: PracticeSession | null;
  stretches: PracticeLog[];
}

/** What's in each box, keyed by stretch or session documentId. */
type Edits = Record<string, { minutes?: string; tempo?: string; note?: string }>;

const hasTempo = (log: PracticeLog) =>
  log.tempoReached != null || log.material?.tempo != null || log.material?.goalTempo != null;

/**
 * A day's practice, to put right after the fact: each piece's minutes, tempo
 * reached and note, each session's notes, and a piece taken out altogether.
 *
 * Minutes go through `/correct`, the intent for a duration the clock got wrong.
 * The tempo reached is corrected on the stretch only: an old session's number
 * shouldn't move where the piece is now. Removing a piece asks first and goes at
 * once, as a trash can does everywhere in the app; the rest waits for "save".
 */
export default function DayEditor({ date, onDone }: { date: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { logs } = usePracticeLogs();
  const sessions = usePracticeSessions(date);
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const groups = useMemo(() => {
    const byKey = new Map<string, Group>();
    const day = [...logs]
      .filter((l) => l.date === date && l.stop)
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    for (const log of day) {
      const sessionId = log.session?.documentId ?? null;
      const subject = log.material?.project;
      const key = sessionId ?? `subject:${subject?.documentId ?? 'none'}`;
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          title: subject?.title ?? 'incidentals',
          session: sessions.find((s) => s.documentId === sessionId) ?? null,
          stretches: [],
        };
        byKey.set(key, group);
      }
      group.stretches.push(log);
    }
    return [...byKey.values()];
  }, [logs, sessions, date]);

  const edit = (id: string, change: Edits[string]) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['practice-logs'] });
    void queryClient.invalidateQueries({ queryKey: ['practice-sessions'] });
  };

  const remove = async (log: PracticeLog) => {
    await apiSend(`/api/practice-logs/${log.documentId}`, 'DELETE').catch(() => setFailed(true));
    refresh();
  };

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      for (const group of groups) {
        const sessionNote = group.session && edits[group.session.documentId]?.note;
        if (group.session && sessionNote !== undefined) {
          await apiSend(`/api/practice-sessions/${group.session.documentId}`, 'PUT', {
            notes: sessionNote,
          });
        }
        for (const log of group.stretches) {
          const e = edits[log.documentId];
          if (!e) continue;
          if (e.minutes !== undefined && e.minutes.trim() !== '') {
            const minutes = Math.round(Number(e.minutes));
            if (Number.isFinite(minutes) && minutes >= 0 && minutes !== log.duration) {
              await apiSend(`/api/practice-logs/${log.documentId}/correct`, 'POST', { minutes });
            }
          }
          const data: Record<string, unknown> = {};
          if (e.note !== undefined) data.notes = noteBlocks(e.note);
          if (e.tempo !== undefined) {
            const tempo = Math.round(Number(e.tempo));
            data.tempoReached = e.tempo.trim() && tempo > 0 ? tempo : null;
          }
          if (Object.keys(data).length > 0) {
            await apiSend(`/api/practice-logs/${log.documentId}`, 'PUT', data);
          }
        }
      }
      refresh();
      onDone();
    } catch {
      setFailed(true);
      setSaving(false);
      refresh();
    }
  };

  if (groups.length === 0) {
    return <p className="m-0 opacity-80">Nothing practiced this day.</p>;
  }

  return (
    <div className="flex flex-col">
      {groups.map((group, g) => (
        <div key={group.key} className="flex flex-col">
          {/* The app's rule between sections: the scale's largest step either side. */}
          <section
            className={`flex flex-col gap-fields ${g > 0 ? 'mt-16 border-t border-base-content/30 pt-16' : ''}`}
          >
            <h3 className="mt-0">
              {group.title} · {group.stretches.reduce((sum, l) => sum + (l.duration ?? 0), 0)} min
            </h3>
            {group.session && (
              <Field label="notes" htmlFor={`notes-${group.session.documentId}`}>
                <Textarea
                  id={`notes-${group.session.documentId}`}
                  rows={2}
                  value={edits[group.session.documentId]?.note ?? group.session.notes ?? ''}
                  onChange={(e) => edit(group.session!.documentId, { note: e.target.value })}
                />
              </Field>
            )}
          </section>

          {group.stretches.map((log) => {
            const e = edits[log.documentId] ?? {};
            const title = log.material?.title ?? 'practice';
            return (
              <div
                key={log.documentId}
                className="mt-16 flex flex-col gap-fields border-t border-base-content/30 pt-16"
              >
                <div className="flex items-center gap-2">
                  <span className="grow font-bold">{title}</span>
                  <DeleteButton
                    aria-label={`remove ${title}`}
                    question={`Take ${title} out of this day's practice?`}
                    onDelete={() => void remove(log)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-fields">
                  <Field label="minutes" htmlFor={`minutes-${log.documentId}`}>
                    <Input
                      id={`minutes-${log.documentId}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={e.minutes ?? String(log.duration ?? 0)}
                      onChange={(ev) => edit(log.documentId, { minutes: ev.target.value })}
                    />
                  </Field>
                  {hasTempo(log) && (
                    <Field label="tempo reached" htmlFor={`tempo-${log.documentId}`}>
                      <Input
                        id={`tempo-${log.documentId}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={e.tempo ?? (log.tempoReached != null ? String(log.tempoReached) : '')}
                        onChange={(ev) => edit(log.documentId, { tempo: ev.target.value })}
                      />
                    </Field>
                  )}
                </div>
                <Field label="note" htmlFor={`note-${log.documentId}`}>
                  <Textarea
                    id={`note-${log.documentId}`}
                    rows={2}
                    value={e.note ?? blocksText(log.notes)}
                    onChange={(ev) => edit(log.documentId, { note: ev.target.value })}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      ))}

      <div className="mt-16 flex flex-col items-center gap-rows">
        {failed && <p className="m-0 text-small italic">couldn&apos;t save all of that; try again</p>}
        <Button onClick={save} disabled={saving}>
          save
        </Button>
      </div>
    </div>
  );
}
