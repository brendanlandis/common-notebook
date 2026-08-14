'use client';

import { useMemo } from 'react';
import { PlayIcon, PauseIcon, StopIcon, MetronomeIcon } from '@phosphor-icons/react';
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
 *   subject, play button.
 * - **running** — full screen, clock, pause and stop.
 * - **paused** — a button in the corner. Pause is the only way out of
 *   full-screen, deliberately: an escape that left the clock running would
 *   reintroduce precisely the forgetting this prevents.
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

  // Nothing running and nothing offered: the modal isn't there at all.
  if (!session && !readyMaterial) return null;

  // Offered but not started. `readyMaterial` is a Task, so it carries its own
  // project — the subject — without a second fetch.
  if (!session && readyMaterial) {
    return (
      <div className="practice-modal is-ready" role="dialog" aria-label="start practicing">
        <div className="practice-modal-body">
          <PracticeSubject title={readyMaterial.title} subject={readyMaterial.project?.title} />
          <button
            type="button"
            className="practice-play"
            aria-label={`start practicing ${readyMaterial.title}`}
            disabled={isStarting}
            onClick={() => {
              start(readyMaterial.documentId);
              // Let go of the offer: from here the server's open session is what
              // puts this on screen, and holding both would leave a stale name
              // behind if the start were refused.
              dismiss();
            }}
          >
            <PlayIcon size={96} weight="regular" />
          </button>
          <button type="button" className="btn practice-dismiss" onClick={dismiss}>
            not now
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
