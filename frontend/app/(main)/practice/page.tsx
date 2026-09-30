"use client";

import { useState } from "react";
import { MetronomeIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import type { Task } from "@/app/types/index";
import PracticeCharts from "./components/PracticeCharts";
import { usePracticeForms } from "./components/PracticeForms";
import { usePracticeLogs } from "./hooks/usePracticeLogs";
import { useLearnedPieces, usePracticeSessions, usePracticeSubject } from "./hooks/usePracticePage";
import { buildHistory, practiceDays, type HistoryDay } from "./lib/history";
import { useTasks } from "@/app/(main)/(todo)/hooks/useTasks";
import { usePracticeSessionUI } from "@/app/contexts/PracticeSessionContext";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { toISODate, getToday, shiftISODate, parseDate, formatInTimezone } from "@/app/lib/dateUtils";
import type { TimeZoneSettings } from "@/app/lib/timeZoneSettings";
import DisclosureToggle from "@/app/components/ui/DisclosureToggle";
import FaviconManager from "@/app/components/ui/FaviconManager";
import Button from "@/app/components/ui/Button";

/** History appears once there are this many practice days in the last 30. */
const HISTORY_AFTER_DAYS = 3;
/** History's days come a week at a time, newest first. */
const DAYS_PER_PAGE = 7;

/**
 * The home for practice: one subject at a time, chosen in the header.
 *
 * Its top of mind — the pieces in rotation — leads, names only; a piece's
 * metronome or name opens its popover (details, start timer, log time) and its
 * pencil edits it. The shelf, on hold and learned follow as three collapsed
 * lines. History covers every subject, and appears once there is enough of it
 * to say something: the 30-day chart, then the last week's days, a week more
 * per "view previous week".
 *
 * Today's picks aren't here: the daily page has them. This page is for keeping
 * the rotation and working through it.
 */
export default function PracticePage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const { subjects, subject } = usePracticeSubject();
  const { tasks, loading } = useTasks();
  const learned = useLearnedPieces(subject?.documentId ?? null);
  const { logs } = usePracticeLogs();

  const today = toISODate(getToday(timeZoneSettings), timeZoneSettings);
  const since = shiftISODate(today, -29); // 29 days ago + today = the chart's 30
  // The days listed: the last week, and a week further back per "view previous week".
  const [weeks, setWeeks] = useState(1);
  const listedSince = shiftISODate(today, -(weeks * DAYS_PER_PAGE - 1));
  const sessions = usePracticeSessions(listedSince);

  const pieces = tasks.filter(
    (t) => subject && t.project?.documentId === subject.documentId && !t.completed
  );
  const top = pieces.filter((t) => t.soon && !t.onHold);
  const shelf = pieces.filter((t) => !t.soon && !t.onHold);
  const hold = pieces.filter((t) => t.onHold);

  const showHistory = practiceDays(logs, since) >= HISTORY_AFTER_DAYS;
  const days = showHistory ? buildHistory(logs, sessions, listedSince) : [];
  const olderPractice = logs.some((l) => l.stop && l.date < listedSince);

  return (
    <>
      <FaviconManager type="metronome" />
      <main id="container-practice">
        <h1 className="mb-title">practice</h1>

        {subjects.length === 0 ? (
          <p>No subjects yet: add one from the header to start.</p>
        ) : (
          <div className="grid items-start gap-sections lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-x-24">
            <section className="flex flex-col gap-sections">
              <div className="flex flex-col gap-heading">
                <h3>top of mind</h3>
                {top.length > 0 ? (
                  <PieceList pieces={top} playable />
                ) : (
                  !loading && <p className="m-0 opacity-80">Nothing top of mind for {subject?.title} yet.</p>
                )}
              </div>

              <div className="flex flex-col">
                <Place label="on the shelf" pieces={shelf} playable />
                <Place label="on hold" pieces={hold} />
                <Place label="learned" pieces={learned} />
              </div>
            </section>

            {showHistory && (
              <section className="flex flex-col gap-heading">
                <h2>history</h2>
                <div className="flex flex-col gap-sections">
                  <PracticeCharts />
                  <div className="flex max-w-160 flex-col gap-lists">
                    {days.map((day) => (
                      <HistoryDaySummary
                        key={day.date}
                        day={day}
                        label={dayLabel(day.date, today, timeZoneSettings)}
                      />
                    ))}
                    {days.length === 0 && (
                      <p className="m-0 opacity-80">Nothing practiced in the last {weeks * DAYS_PER_PAGE} days.</p>
                    )}
                    {olderPractice && (
                      <div>
                        <Button small onClick={() => setWeeks(weeks + 1)}>
                          view previous week
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}

/**
 * Pieces by name. A playable one (top of mind, the shelf) leads with its
 * metronome; its metronome and its name both open its popover. Every one ends
 * in the pencil that edits it — which is also how a piece moves between places.
 */
function PieceList({ pieces, playable = false }: { pieces: Task[]; playable?: boolean }) {
  const { openFor } = usePracticeSessionUI();
  const { editPiece } = usePracticeForms();

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {pieces.map((piece) => (
        <li key={piece.documentId} className="flex items-center gap-1">
          {playable ? (
            <>
              <button
                type="button"
                aria-label={`practice ${piece.title}`}
                className="flex h-11 w-10 shrink-0 items-center"
                onClick={() => openFor(piece)}
              >
                <MetronomeIcon size={25} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="min-h-11 min-w-0 grow text-left"
                onClick={() => openFor(piece)}
              >
                {piece.title}
              </button>
            </>
          ) : (
            <span className="min-w-0 grow py-2 pl-11">{piece.title}</span>
          )}
          <button
            type="button"
            aria-label={`edit ${piece.title}`}
            className="flex h-11 w-11 shrink-0 items-center justify-end"
            onClick={() => editPiece(piece)}
          >
            <PencilSimpleIcon size={20} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One of the places below top of mind: a line with a count, closed until opened. Hidden when empty. */
function Place({ label, pieces, playable = false }: { label: string; pieces: Task[]; playable?: boolean }) {
  const [open, setOpen] = useState(false);
  if (pieces.length === 0) return null;
  return (
    <div className="flex flex-col">
      <DisclosureToggle expanded={open} onToggle={() => setOpen(!open)} className="min-h-11">
        {label} <span className="opacity-80">{pieces.length}</span>
      </DisclosureToggle>
      {open && (
        <div className="pl-4">
          <PieceList pieces={pieces} playable={playable} />
        </div>
      )}
    </div>
  );
}

/**
 * A day of practice: a bullet per subject, minutes first, with the session's
 * note on the same line; under it, a bullet per piece that has a note, its name
 * and the note. Notes in italics.
 */
function HistoryDaySummary({ day, label }: { day: HistoryDay; label: string }) {
  const { editDay } = usePracticeForms();
  return (
    <div className="flex flex-col gap-rows">
      <div className="flex items-start gap-2">
        <h3 className="grow">{label}</h3>
        <button
          type="button"
          aria-label={`edit ${label}'s practice`}
          className="-mt-2 flex h-9 w-11 shrink-0 items-start justify-end pt-2"
          onClick={() => editDay(day.date, label)}
        >
          <PencilSimpleIcon size={20} aria-hidden="true" />
        </button>
      </div>
      <ul className="m-0 flex list-disc flex-col gap-rows pl-5">
        {day.subjects.map((s) => (
          <li key={s.key}>
            <span>
              {s.minutes} min · {s.title}
            </span>
            {s.note && <span className="italic opacity-80"> — {s.note}</span>}
            {s.pieces.length > 0 && (
              <ul className="mt-1 flex list-[circle] flex-col gap-1 pl-5">
                {s.pieces.map((p, i) => (
                  <li key={`${p.title}-${i}`}>
                    {p.title}
                    <span className="italic opacity-80"> — {p.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "today" / "yesterday" / "thu 8/14" — the same wording and format the Done view
 * uses. The comparisons are on `YYYY-MM-DD` strings, where lexicographic order
 * is chronological; only the fallback label parses, through the user's zone.
 */
function dayLabel(date: string, today: string, settings: TimeZoneSettings): string {
  if (date === today) return "today";
  if (date === shiftISODate(today, -1)) return "yesterday";
  return formatInTimezone(parseDate(date, settings), "EEE MM/d", settings).toLowerCase();
}
