'use client';

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowSquareOutIcon, MetronomeIcon, XIcon } from '@phosphor-icons/react';
import type { BlocksContent } from '@strapi/blocks-react-renderer';
import RichTextDisplay from '@/app/components/ui/RichTextDisplay';
import { usePracticeLogs } from '@/app/(main)/practice/hooks/usePracticeLogs';
import { useDateTimeSettings } from '@/app/contexts/DateTimeSettingsContext';
import { getToday, toISODate } from '@/app/lib/dateUtils';
import type { PracticeLog, Task } from '@/app/types/index';

/**
 * When a piece was last practiced, the way you'd say it: "today", "3 days ago",
 * "9/12", with the minutes that day's session gave it.
 *
 * Counted in effective days — a log's `date` is already the effective day of its
 * start — so a session at 1am under a 4am boundary is "yesterday" at noon.
 */
export function lastTimeLabel(log: Pick<PracticeLog, 'date' | 'duration'>, todayISO: string): string {
  const days = Math.round(
    (Date.parse(`${todayISO}T00:00:00Z`) - Date.parse(`${log.date}T00:00:00Z`)) / 86_400_000,
  );
  const when =
    days <= 0
      ? 'today'
      : days === 1
        ? 'yesterday'
        : days < 14
          ? `${days} days ago`
          : `${Number(log.date.slice(5, 7))}/${Number(log.date.slice(8, 10))}`;
  return log.duration > 0 ? `${when}, ${log.duration} min` : when;
}

/** The tempo line, or nothing for a piece that doesn't use one. */
export function tempoLabel(piece: Pick<Task, 'tempo' | 'goalTempo'>): string | null {
  if (piece.tempo && piece.goalTempo) return `${piece.tempo} bpm, goal ${piece.goalTempo}`;
  if (piece.tempo) return `${piece.tempo} bpm`;
  if (piece.goalTempo) return `goal ${piece.goalTempo} bpm`;
  return null;
}

/** What a link is called on the page: its site, which says more than "link". */
function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** True when the notes say something: an empty editor still saves a blank paragraph. */
function hasText(nodes: unknown[] | null | undefined): boolean {
  return (nodes ?? []).some((node) => {
    const n = node as { text?: unknown; children?: unknown[] };
    return (typeof n.text === 'string' && n.text.trim() !== '') || hasText(n.children);
  });
}

/**
 * A piece of practice material, opened from its metronome or its name — on the
 * practice page, the daily page, anywhere a piece is listed.
 *
 * Its name, its details where it has them, and "start timer". No subject or
 * category line: you opened it from a list that already says both. It is the timer's ready
 * state: pressing start leaves this up, button disabled, until the running timer
 * replaces it, so there is no gap between the two where the page flashes through.
 */
export default function PiecePopover({
  piece,
  onClose,
  onStart,
  starting,
}: {
  piece: Task;
  onClose: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const { timeZoneSettings } = useDateTimeSettings();
  const { logs } = usePracticeLogs(piece.documentId);
  const last = logs.find((log) => log.stop);
  const todayISO = toISODate(getToday(timeZoneSettings), timeZoneSettings);

  const tempo = tempoLabel(piece);

  const details: { label: string; value: ReactNode }[] = [];
  if (tempo) details.push({ label: 'tempo', value: tempo });
  if (piece.link) {
    details.push({
      label: 'link',
      value: (
        <a href={piece.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
          {linkLabel(piece.link)}
          <ArrowSquareOutIcon size={14} aria-hidden="true" />
        </a>
      ),
    });
  }
  if (last) details.push({ label: 'last time', value: lastTimeLabel(last, todayISO) });
  if (hasText(piece.description)) {
    details.push({
      label: 'notes',
      value: <RichTextDisplay content={piece.description as BlocksContent} className="[&_p]:m-0" />,
    });
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* The same shadow over the page as the running timer, so opening a
            piece and practicing it read as one place. */}
        <Dialog.Overlay className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-black/55 p-4">
          <Dialog.Content
            aria-describedby={undefined}
            className="flex w-full max-w-110 flex-col gap-sections rounded-2xl bg-base-100 p-6 text-left shadow-[0_1.5rem_3rem_rgb(0_0_0/0.35)]"
          >
            <div className="flex items-start gap-4">
              <Dialog.Title asChild>
                <h2 className="m-0 min-w-0 grow">{piece.title}</h2>
              </Dialog.Title>
              <Dialog.Close
                className="-mt-1 -mr-1 inline-flex shrink-0 p-1"
                aria-label="close"
              >
                <XIcon size={24} weight="regular" />
              </Dialog.Close>
            </div>

            {details.length > 0 && (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                {details.map(({ label, value }) => (
                  <div key={label} className="contents">
                    <dt className="text-small opacity-80">{label}</dt>
                    <dd className="m-0">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-wrap gap-controls">
              <button
                type="button"
                className="btn rounded-[0.2rem] border border-base-content bg-base-content px-5 text-body text-base-100 shadow-none active:translate-none disabled:opacity-40"
                disabled={starting}
                onClick={onStart}
              >
                <MetronomeIcon size={20} aria-hidden="true" />
                start timer
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
