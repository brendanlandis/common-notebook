import type { PracticeLog, PracticeSession, StrapiBlock } from '@/app/types/index';

/** One subject's line in a day: its minutes, the session note, and each piece that has a note. */
export interface HistorySubject {
  key: string;
  title: string;
  minutes: number;
  note: string | null;
  pieces: { title: string; note: string }[];
}

export interface HistoryDay {
  date: string;
  subjects: HistorySubject[];
}

const NO_SUBJECT = '__incidentals__';

/** The words in a rich-text note, one line; empty for a note that says nothing. */
export function blocksText(blocks: StrapiBlock[] | null | undefined): string {
  const out: string[] = [];
  const walk = (nodes: unknown[] | undefined) => {
    for (const node of nodes ?? []) {
      const n = node as { text?: unknown; children?: unknown[] };
      if (typeof n.text === 'string') out.push(n.text);
      walk(n.children);
    }
  };
  walk(blocks as unknown[] | undefined);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** A finished stretch: the clock stopped, or logged afterwards. */
const finished = (log: PracticeLog) => Boolean(log.stop);

/**
 * Days practiced since `since` (inclusive), any subject. History appears only
 * once there are three: before that there is nothing a chart can show.
 */
export function practiceDays(logs: PracticeLog[], since: string): number {
  return new Set(logs.filter((l) => finished(l) && l.date >= since).map((l) => l.date)).size;
}

/**
 * The practice record as history shows it: newest day first; in each, a line per
 * subject with its minutes and the note on its session, and under it each piece
 * that has a note that day.
 *
 * Grouped by day and subject rather than by session, so stretches from before
 * sessions existed — which have none — read exactly like new ones. Two sessions
 * of one subject on one day are one line, their notes joined.
 */
export function buildHistory(
  logs: PracticeLog[],
  sessions: PracticeSession[],
  since: string,
): HistoryDay[] {
  const days = new Map<string, Map<string, HistorySubject>>();

  const lineFor = (date: string, key: string, title: string) => {
    let day = days.get(date);
    if (!day) days.set(date, (day = new Map()));
    let line = day.get(key);
    if (!line) day.set(key, (line = { key, title, minutes: 0, note: null, pieces: [] }));
    return line;
  };

  const ordered = [...logs]
    .filter((l) => finished(l) && l.date >= since)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  for (const log of ordered) {
    const subject = log.material?.project;
    const line = lineFor(log.date, subject?.documentId ?? NO_SUBJECT, subject?.title ?? 'incidentals');
    line.minutes += log.duration ?? 0;
    const note = blocksText(log.notes);
    if (note) line.pieces.push({ title: log.material?.title ?? 'practice', note });
  }

  for (const session of sessions) {
    const note = session.notes?.trim();
    if (!note || session.date < since) continue;
    const line = days.get(session.date)?.get(session.subject?.documentId ?? NO_SUBJECT);
    if (!line) continue; // a session with no finished minutes has nothing to hang a note on
    line.note = line.note ? `${line.note} · ${note}` : note;
  }

  // A line with no minutes and nothing written — a session stopped inside its
  // first minute — says nothing, and neither does a day made only of those.
  const says = (line: HistorySubject) => line.minutes > 0 || line.note || line.pieces.length > 0;

  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, subjects]) => ({
      date,
      subjects: [...subjects.values()].filter(says).sort((a, b) => b.minutes - a.minutes),
    }))
    .filter((day) => day.subjects.length > 0);
}
