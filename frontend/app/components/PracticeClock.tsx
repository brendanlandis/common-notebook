'use client';

import { useEffect, useState } from 'react';
import { elapsedMs, isRunning, type PracticeSegment } from '@/app/lib/practiceSession';

/**
 * How long you have practised in this session, ticking.
 *
 * Reads the *segments* rather than counting from a start time, which is the
 * whole difference between this and the timer it replaces: the old one showed
 * `now - start`, so a session paused for lunch came back claiming an hour of
 * scales. Pauses are gaps between segments, and gaps are not practice.
 *
 * Only ticks while something is running. A paused clock is a fixed number, and
 * an interval re-rendering it every second to show the same digits is work for
 * nothing.
 */
export default function PracticeClock({ segments }: { segments: PracticeSegment[] }) {
  const running = isRunning(segments);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  // Read the clock at render time rather than holding the elapsed value in
  // state: the state would be one second stale on the first paint after a
  // resume, and `setTick` exists only to schedule the re-render.
  return (
    <div className="practice-clock" role="timer" aria-live="off">
      {formatElapsed(elapsedMs(segments, new Date()))}
    </div>
  );
}

/** `m:ss` under an hour, `h:mm:ss` over — the format the old timer used. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
