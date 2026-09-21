'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PlayIcon, PauseIcon, StopIcon, MetronomeIcon, XIcon } from '@phosphor-icons/react';
import { useActiveSession } from '@/app/(main)/practice/hooks/usePracticeSession';
import { usePracticeSessionUI } from '@/app/contexts/PracticeSessionContext';
import { useDateTimeSettings } from '@/app/contexts/DateTimeSettingsContext';
import { isStale } from '@/app/lib/practiceSession';
import PracticeClock from '@/app/(main)/practice/components/PracticeClock';
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
 * - **ready** — you clicked a practice icon and haven't pressed play. Name,
 *   subject, play button, and a close in the corner.
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
  const { session, segments, running, start, pause, resume, stop, correct, isStarting, isStopping, isToggling } =
    useActiveSession();

  const material = session?.material ?? null;

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

  // Nothing running and nothing offered: the modal isn't there at all.
  if (!session && !readyMaterial) return null;

  // Offered but not started. `readyMaterial` is a Task, so it carries its own
  // project — the subject — without a second fetch.
  if (!session && readyMaterial) {
    return (
      <PracticeModal label="start practicing" onEscape={dismiss}>
          <button
            type="button"
            // Top right, and only in the ready state — the running panel
        // deliberately has no close. A dismiss that left the clock running is
        // exactly the "hide but keep practicing" escape the whole design is
        // built to refuse, and PracticeSessionModal.test.tsx asserts its
        // absence there.
        className="absolute top-2 right-2 inline-flex cursor-pointer p-2 opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 [transition-duration:var(--transition-time)]"
            aria-label="close"
            onClick={dismiss}
          >
            <XIcon size={20} weight="bold" />
          </button>
          <PracticeSubject title={readyMaterial.title} subject={readyMaterial.project?.title} />
          <button
            type="button"
            className="cursor-pointer transition-opacity [transition-duration:var(--transition-time)] disabled:cursor-default disabled:opacity-40"
            aria-label={`start practicing ${readyMaterial.title}`}
            disabled={isStarting}
            onClick={() => start(readyMaterial.documentId)}
          >
            <PlayIcon size={96} weight="regular" />
          </button>
      </PracticeModal>
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
        className="fixed top-3 right-3 z-60 flex cursor-pointer items-center gap-2 rounded-full border border-current bg-base-100 px-3 py-1.5 [&_[role=timer]]:text-body"
        aria-label={`resume practicing ${material?.title ?? 'your session'}`}
        disabled={isToggling}
        onClick={resume}
      >
        <MetronomeIcon size={22} weight="regular" aria-hidden="true" />
        <PracticeClock segments={segments} />
      </button>
    );
  }

  return (
    <PracticeModal label="practicing">
        <PracticeSubject title={material?.title} subject={material?.project?.title} />
        <PracticeClock segments={segments} />

        <div className="flex gap-5 sm:gap-8">
          <button
            type="button"
            className="cursor-pointer transition-opacity [transition-duration:var(--transition-time)] disabled:cursor-default disabled:opacity-40"
            aria-label="pause"
            disabled={isToggling}
            onClick={pause}
          >
            <PauseIcon size={64} weight="regular" />
          </button>
          <button
            type="button"
            className="cursor-pointer transition-opacity [transition-duration:var(--transition-time)] disabled:cursor-default disabled:opacity-40"
            aria-label="stop"
            disabled={isStopping}
            onClick={stop}
          >
            <StopIcon size={64} weight="regular" />
          </button>
        </div>

        {/* The correction. Offered rather than forced — sometimes it really was
            four hours, and the clock above still says so. Nothing is truncated
            and stopping normally stays available; this is only here because the
            segments cannot tell four hours of practice from four hours of the
            tab being open, and you can. */}
        {stale && (
          <div className="flex flex-col items-center gap-3 opacity-85 [&_p]:m-0">
            <p>you left this running — call it</p>
            <div className="flex flex-wrap justify-center gap-2">
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
function PracticeModal({
  label,
  onEscape,
  children,
}: {
  label: string;
  /** Escape closes only the ready panel; while a session runs it does nothing. */
  onEscape?: () => void;
  children: ReactNode;
}) {
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
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              onEscape?.();
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            className="relative flex w-full max-w-104 flex-col items-center gap-8 rounded-2xl bg-base-100 px-8 py-10 text-center shadow-[0_1.5rem_3rem_rgb(0_0_0/0.35)]"
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
    <div>
      <h2 className="m-0">{title ?? 'practice'}</h2>
      {/* Muted because you know what instrument you are holding — it is there to
          disambiguate two pieces with similar names, not to be read every
          time. */}
      {subject && <p className="mt-1 mb-0 opacity-60">{subject}</p>}
    </div>
  );
}
