'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowsLeftRightIcon, PauseIcon, StopIcon, MetronomeIcon } from '@phosphor-icons/react';
import { useActiveSession } from '@/app/(main)/practice/hooks/usePracticeSession';
import { usePracticeSessionUI } from '@/app/contexts/PracticeSessionContext';
import { useDateTimeSettings } from '@/app/contexts/DateTimeSettingsContext';
import { isStale, parseSegments } from '@/app/lib/practiceSession';
import PracticeClock from '@/app/(main)/practice/components/PracticeClock';
import PiecePopover from '@/app/(main)/practice/components/PiecePopover';
import PracticeNoteDialog, { type NotePiece } from '@/app/(main)/practice/components/PracticeNoteDialog';
import { useTasks } from '@/app/(main)/(todo)/hooks/useTasks';
import type { PracticeLog, Task } from '@/app/types/index';
import Button from "@/app/components/ui/Button";

/**
 * Practicing, over whatever you were looking at.
 *
 * The practice screen is a modal rather than a page on purpose. Practicing is
 * the one thing in this app that isn't reading or deciding, and it should have
 * nothing on it but the clock and the name of what you're playing — a page you
 * navigate *to* would leave the rest of the app one click away, which is exactly
 * the click that turns twenty minutes of scales into twenty minutes of tidying
 * the task list.
 *
 * It also makes a dangling session hard to ignore, which is the other half of
 * the design: with no heartbeat to bound a forgotten timer, the thing that stops
 * you forgetting is that you cannot use the app without dealing with it.
 *
 * Three states:
 *
 * - **ready** — you opened a piece and haven't started it: its popover
 *   (`PiecePopover`), with its details, "start timer", and a close in the corner.
 * - **running** — the same panel, with a clock, pause and stop, and **no close**.
 * - **paused** — a button in the corner. Pause is the only way out,
 *   deliberately: an escape that left the clock running would reintroduce
 *   precisely the forgetting this prevents.
 *
 * The panel is a dialog over a dimmed page rather than an opaque full-bleed
 * screen. The property that matters isn't that the app is invisible, it's that
 * the app is *unreachable* — the backdrop still covers everything and eats every
 * click, so a running session is still something you have to deal with before you
 * can do anything else. Hiding the page as well only made it hard to tell the
 * practice screen from a navigation.
 */
export default function PracticeSessionModal() {
  const { timeZoneSettings } = useDateTimeSettings();
  const { readyMaterial, dismiss } = usePracticeSessionUI();
  const {
    session,
    segments,
    running,
    start,
    pause,
    resume,
    stop,
    switchTo,
    correct,
    isStarting,
    isStopping,
    isSwitching,
    isToggling,
  } = useActiveSession();
  const { tasks } = useTasks();

  const material = session?.material ?? null;

  /**
   * The note being asked for: on the piece just left (the clock already on the
   * next), or after stop on the last piece and the session. It outlives the
   * running session, since a stopped one is no longer "active".
   */
  const [note, setNote] = useState<
    | { mode: 'switch'; piece: NotePiece; next: string }
    | { mode: 'stop'; piece: NotePiece; earlier: { title: string; minutes: number }[]; session: string | null }
    | null
  >(null);

  // This session's stretches, in the order they were played.
  const stretches = useMemo(
    () =>
      [...(session?.session?.practice_logs ?? [])].sort((a, b) =>
        String(a.start).localeCompare(String(b.start))
      ),
    [session]
  );

  /**
   * The whole session's stretches of practice, for the big clock: every piece
   * played so far, then the one playing now. "Switch to" keeps the clock running,
   * so the clock is the session's, and the piece's own time sits under it.
   */
  const earlierSegments = useMemo(
    () =>
      stretches
        .filter((s) => s.documentId !== session?.documentId)
        .flatMap((s) => parseSegments(s.segments)),
    [stretches, session]
  );
  const sessionSegments = useMemo(() => [...earlierSegments, ...segments], [earlierSegments, segments]);

  /**
   * What "switch to" offers: the session's subject's top of mind — in rotation,
   * not on hold, not learned — without the piece already playing, each with the
   * minutes it has had so far this session.
   */
  const switchable = useMemo(() => {
    if (!session) return [];
    const subject = session.session?.subject?.documentId ?? material?.project?.documentId;
    if (!subject) return [];
    const minutes = new Map<string, number>();
    for (const s of stretches) {
      const id = s.material?.documentId;
      if (id && s.stop) minutes.set(id, (minutes.get(id) ?? 0) + (s.duration ?? 0));
    }
    return tasks
      .filter(
        (t) =>
          t.project?.documentId === subject &&
          t.soon &&
          !t.onHold &&
          !t.completed &&
          t.documentId !== material?.documentId
      )
      .map((t) => ({ task: t, minutes: minutes.get(t.documentId) ?? 0 }));
  }, [session, stretches, tasks, material]);

  const pieceOf = (log: PracticeLog, piece: Task | null | undefined): NotePiece => ({
    log: log.documentId,
    title: piece?.title ?? 'practice',
    minutes: log.duration ?? 0,
    tempo: piece?.tempo ?? null,
    goalTempo: piece?.goalTempo ?? null,
  });

  const handleSwitch = async (next: Task) => {
    const leaving = material;
    const result = await switchTo(next.documentId).catch(() => null);
    if (result?.closed) {
      setNote({ mode: 'switch', piece: pieceOf(result.closed, leaving), next: next.title });
    }
  };

  const handleStop = async () => {
    const last = material;
    const earlier = stretches
      .filter((s) => s.stop && s.documentId !== session?.documentId)
      .map((s) => ({ title: s.material?.title ?? 'practice', minutes: s.duration ?? 0 }));
    const sitting = session?.session?.documentId ?? null;
    const stopped = await stop().catch(() => null);
    if (stopped) {
      setNote({ mode: 'stop', piece: pieceOf(stopped, last), earlier, session: sitting });
    }
  };

  // Only offer to correct a session that has been running long enough to be
  // suspect — see `isStale`. Recomputed on every render, which is exactly often
  // enough: the clock re-renders each second while running, so the controls
  // appear within a second of the threshold without a timer of their own.
  const stale = useMemo(
    () => (session ? isStale(segments, new Date(), timeZoneSettings) : false),
    [session, segments, timeZoneSettings]
  );

  /**
   * Let go of the offer once there is a real session to show instead.
   *
   * This used to happen in the play button's `onClick`, immediately after
   * `start()` — which cleared `readyMaterial` while the POST was still in flight,
   * leaving neither an offer nor a session for the length of the round trip. The
   * modal unmounted and the page flashed through behind it before the running
   * screen appeared.
   *
   * Waiting for the session instead means the ready panel simply stays put (with
   * its play button disabled) until the server answers, and the two states hand
   * over with nothing in between. It also leaves the offer intact when a start is
   * *refused*, so the material is still named and the button can be pressed
   * again, rather than the whole thing vanishing with no explanation.
   *
   * Safe against the other order too: `openFor` while something is already
   * running clears immediately, which is right — you cannot start a second one.
   */
  useEffect(() => {
    if (session && readyMaterial) dismiss();
  }, [session, readyMaterial, dismiss]);

  // A note after switching or stopping comes first: it is what just happened.
  if (note) {
    return note.mode === 'switch' ? (
      <PracticeNoteDialog mode="switch" piece={note.piece} next={note.next} onDone={() => setNote(null)} />
    ) : (
      <PracticeNoteDialog
        mode="stop"
        piece={note.piece}
        earlier={note.earlier}
        session={note.session}
        onDone={() => setNote(null)}
      />
    );
  }

  // Nothing running and nothing offered: the modal isn't there at all.
  if (!session && !readyMaterial) return null;

  // Offered but not started: the piece's popover, whose "start timer" starts it.
  // `readyMaterial` is a Task, so it carries its own project — the subject —
  // without a second fetch.
  if (!session && readyMaterial) {
    return (
      <PiecePopover
        piece={readyMaterial}
        onClose={dismiss}
        onStart={() => start(readyMaterial.documentId)}
        starting={isStarting}
      />
    );
  }

  if (!session) return null;

  // Paused: out of the way, but not gone.
  if (!running) {
    return (
      <button
        type="button"
        // Paused: a small button, top right, over everything. Still visible
        // from every page, because a paused session you cannot see is a session
        // you will forget.
        className="fixed top-3 right-3 z-60 flex items-center gap-2 rounded-full border border-current bg-base-100 px-3 py-1.5 [&_[role=timer]]:text-body"
        aria-label={`resume practicing ${material?.title ?? 'your session'}`}
        disabled={isToggling}
        onClick={resume}
      >
        <MetronomeIcon size={22} weight="regular" aria-hidden="true" />
        <PracticeClock segments={sessionSegments} />
      </button>
    );
  }

  return (
    <PracticeModal label="practicing">
        <PracticeSubject title={material?.title} subject={material?.project?.title} />
        <div className="flex flex-col items-center gap-2">
          <PracticeClock segments={sessionSegments} />
          {earlierSegments.length > 0 && (
            <div className="flex items-baseline gap-1 text-small opacity-80">
              this piece <PracticeClock segments={segments} className="text-small" />
            </div>
          )}
        </div>

        <div className="flex gap-8">
          <button
            type="button"
            className="transition-opacity [transition-duration:var(--transition-time)] disabled:opacity-40"
            aria-label="pause"
            disabled={isToggling}
            onClick={pause}
          >
            <PauseIcon size={64} weight="regular" />
          </button>
          <button
            type="button"
            className="transition-opacity [transition-duration:var(--transition-time)] disabled:opacity-40"
            aria-label="stop"
            disabled={isStopping}
            onClick={handleStop}
          >
            <StopIcon size={64} weight="regular" />
          </button>
        </div>

        {/* The correction. Offered rather than forced — sometimes it really was
            four hours, and the clock above still says so. Nothing is truncated
            and stopping normally stays available; this is only here because the
            segments cannot tell four hours of practice from four hours of the
            tab being open, and you can. */}
        {/* Move on without stopping the clock. Only this subject's top of mind:
            a session is one subject. */}
        {switchable.length > 0 && (
          <div className="flex w-full flex-col gap-1 border-t border-base-content/30 pt-6 text-left">
            <h3 className="m-0 mb-1 text-small font-bold tracking-[0.08em] uppercase opacity-80">
              switch to
            </h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {switchable.map(({ task, minutes }) => (
                <li key={task.documentId}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 text-left disabled:opacity-40"
                    disabled={isSwitching}
                    onClick={() => handleSwitch(task)}
                  >
                    <ArrowsLeftRightIcon size={20} aria-hidden="true" className="shrink-0" />
                    <span className="grow">{task.title}</span>
                    {minutes > 0 && (
                      <span className="text-small tabular-nums opacity-80">{minutes} min</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stale && (
          <div className="flex flex-col items-center gap-rows opacity-85 [&_p]:m-0">
            <p>you left this running — call it</p>
            <div className="flex flex-wrap justify-center gap-controls">
              {[30, 60, 90, 120].map((minutes) => (
                <Button key={minutes} onClick={() => correct(minutes)}>
                  {minutes} min
                </Button>
              ))}
            </div>
          </div>
        )}
    </PracticeModal>
  );
}

/**
 * A panel over a dimmed page, not a full-bleed takeover. What the design needs
 * is that the app is *unreachable* while a session runs — the backdrop covers
 * everything and eats every click, so a forgotten timer is impossible to ignore
 * and pausing remains the only way back to the app. Painting the page out
 * entirely as well was a step past that: it stopped reading as a modal and
 * started reading as a navigation, with no visible edge to say otherwise.
 */
function PracticeModal({ label, children }: { label: string; children: ReactNode }) {
  // Radix Dialog keeps Tab inside the panel and the page behind from scrolling,
  // which a plain overlay did not: the backdrop ate clicks, but Tab still walked
  // into the app behind it. Clicking the backdrop never closes it.
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        {/* Literal black rather than a theme token: this is a shadow over the
            page, and it has to read as one against a light theme and a dark
            one alike. */}
        <Dialog.Overlay className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-black/55 p-4">
          <Dialog.Content
            aria-describedby={undefined}
            // Escape does nothing while a session runs: pause is the way out.
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            className="relative flex w-full max-w-104 flex-col items-center gap-sections rounded-2xl bg-base-100 px-8 py-10 text-center shadow-[0_1.5rem_3rem_rgb(0_0_0/0.35)]"
          >
            <Dialog.Title className="sr-only">{label}</Dialog.Title>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** What you're practicing, and what it's part of. */
function PracticeSubject({ title, subject }: { title?: string; subject?: string }) {
  return (
    <div className="flex flex-col gap-heading">
      <h2 className="m-0">{title ?? 'practice'}</h2>
      {/* Muted because you know what instrument you are holding — it is there to
          disambiguate two pieces with similar names, not to be read every
          time. */}
      {subject && <p className="mb-0 opacity-60">{subject}</p>}
    </div>
  );
}
