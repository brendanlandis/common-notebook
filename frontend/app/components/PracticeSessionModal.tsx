'use client';

import { useEffect, useMemo } from 'react';
import { PlayIcon, PauseIcon, StopIcon, MetronomeIcon, XIcon } from '@phosphor-icons/react';
import { useActiveSession } from '@/app/hooks/usePracticeSession';
import { usePracticeSessionUI } from '@/app/contexts/PracticeSessionContext';
import { useDateTimeSettings } from '@/app/contexts/DateTimeSettingsContext';
import { isStale } from '@/app/lib/practiceSession';
import PracticeClock from './PracticeClock';

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
      <div className="practice-modal is-ready" role="dialog" aria-label="start practicing">
        <div className="practice-modal-body">
          <button
            type="button"
            className="practice-close"
            aria-label="close"
            onClick={dismiss}
          >
            <XIcon size={20} weight="bold" />
          </button>
          <PracticeSubject title={readyMaterial.title} subject={readyMaterial.project?.title} />
          <button
            type="button"
            className="practice-play"
            aria-label={`start practicing ${readyMaterial.title}`}
            disabled={isStarting}
            onClick={() => start(readyMaterial.documentId)}
          >
            <PlayIcon size={96} weight="regular" />
          </button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Paused: out of the way, but not gone.
  if (!running) {
    return (
      <button
        type="button"
        className="practice-collapsed"
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
    <div className="practice-modal is-running" role="dialog" aria-label="practicing">
      <div className="practice-modal-body">
        <PracticeSubject title={material?.title} subject={material?.project?.title} />
        <PracticeClock segments={segments} />

        <div className="practice-controls-row">
          <button
            type="button"
            className="practice-pause"
            aria-label="pause"
            disabled={isToggling}
            onClick={pause}
          >
            <PauseIcon size={64} weight="regular" />
          </button>
          <button
            type="button"
            className="practice-stop"
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
          <div className="practice-correction">
            <p>you left this running — call it</p>
            <div className="practice-correction-options">
              {[30, 60, 90, 120].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className="btn"
                  onClick={() => correct(minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** What you're practicing, and what it's part of. */
function PracticeSubject({ title, subject }: { title?: string; subject?: string }) {
  return (
    <div className="practice-subject">
      <h2>{title ?? 'practice'}</h2>
      {subject && <p>{subject}</p>}
    </div>
  );
}
