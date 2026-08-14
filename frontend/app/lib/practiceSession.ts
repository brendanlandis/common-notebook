import { getEffectiveDayForTimestamp } from './dayBoundaryHelpers';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * A practice session, as a list of the stretches you were actually practicing.
 *
 * ## Why segments at all
 *
 * A session can be paused, and it has to survive the tab closing — closing the
 * tab mid-practice is the *normal* path here, not a failure, because the phone
 * you started on goes in your pocket. So the state cannot live in the client:
 * it lives in `practice-log.segments`, and every play/pause/stop is a write.
 *
 * That makes `duration` no longer derivable from `stop - start`. A 40-minute
 * sitting with 15 minutes of pause is 25 minutes practiced, and the sum of the
 * segments is the only place that number exists.
 *
 * ## Why segments rather than an event log
 *
 * `[{start, stop}]` rather than `[{type: 'play'|'pause', at}]` because an open
 * segment *is* the running one — there is no state machine to get wrong and no
 * way to record two plays in a row. Everything below reduces to "is the last
 * segment open?".
 *
 * ## Why this is JSON when sessions are rows
 *
 * The standing rule in this codebase is that anything you aggregate across rows
 * must be a column, not a JSON blob — that is why a session is a `practice-log`
 * row and not an entry in a `workSessions`-style array on the task. Segments are
 * the opposite case: scratch state on the session's own row, read only by the
 * session it belongs to, and collapsed into the plain `duration` integer the
 * moment you press stop. Nothing ever queries inside it.
 *
 * ## Idempotency
 *
 * Every transformation here is idempotent, and that is load-bearing rather than
 * tidy. Two devices hold the same session: pausing an already-paused session, or
 * stopping an already-stopped one, has to be a no-op, because a phone in your
 * pocket with a stale view of the world will do exactly that. A stale client can
 * then only ever re-assert something already true — it can never resurrect a
 * session the other device ended.
 */

export interface PracticeSegment {
  /** ISO instant. */
  start: string;
  /** ISO instant, or null while this stretch is still running. */
  stop: string | null;
}

/** Only the last segment may be open; a running session has exactly one. */
export function isRunning(segments: PracticeSegment[]): boolean {
  const last = segments[segments.length - 1];
  return last !== undefined && last.stop === null;
}

/**
 * Read a `segments` value off a row.
 *
 * Defensive to the point of paranoia because this is a JSON column: it can hold
 * anything a hand-edit or a half-finished write left behind, and a practice
 * timer that throws on load is worse than one that reports zero. Anything
 * unrecognizable is dropped rather than guessed at.
 *
 * Two shapes are normalized rather than rejected, because both are recoverable
 * and both would otherwise corrupt the total:
 *
 * - A segment whose `stop` precedes its `start` contributes nothing, rather than
 *   a negative number that would silently eat time from the segments around it.
 * - An open segment anywhere but last is closed at the following segment's start.
 *   Only the last one may be open, and a middle one left open means a write
 *   landed out of order; ending it where the next stretch begins is the only
 *   reading that doesn't double-count the overlap.
 */
export function parseSegments(value: unknown): PracticeSegment[] {
  if (!Array.isArray(value)) return [];

  const parsed: PracticeSegment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const { start, stop } = entry as Record<string, unknown>;
    if (typeof start !== 'string' || !isInstant(start)) continue;
    if (stop === null || stop === undefined) {
      parsed.push({ start, stop: null });
      continue;
    }
    if (typeof stop !== 'string' || !isInstant(stop)) continue;
    // A backwards segment is kept but collapsed, so its start still marks where
    // the stretch began without its length going negative.
    parsed.push({ start, stop: Date.parse(stop) < Date.parse(start) ? start : stop });
  }

  // Close any open segment that isn't last.
  for (let i = 0; i < parsed.length - 1; i += 1) {
    if (parsed[i].stop === null) parsed[i] = { ...parsed[i], stop: parsed[i + 1].start };
  }

  return parsed;
}

function isInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

/**
 * Milliseconds actually practiced, counting an open segment up to `now`.
 *
 * `now` is a real instant and is only ever subtracted from another instant, so
 * no zone question arises here — see `staleSince` for the one place in this file
 * that does have to know the user's clock.
 */
export function elapsedMs(segments: PracticeSegment[], now: Date): number {
  return segments.reduce((total, segment) => {
    const from = Date.parse(segment.start);
    const to = segment.stop === null ? now.getTime() : Date.parse(segment.stop);
    return total + Math.max(0, to - from);
  }, 0);
}

/**
 * What goes in the `duration` column: whole minutes, rounded.
 *
 * Rounded rather than floored to match what the stop route has always written,
 * so a two-and-a-half minute session reads as three rather than two and the
 * chart's totals don't drift downwards over a few hundred sessions.
 */
export function durationMinutes(segments: PracticeSegment[], now: Date): number {
  return Math.round(elapsedMs(segments, now) / 60_000);
}

/**
 * Pause: close the open segment. A no-op when nothing is running.
 *
 * Returns the same array reference when there is nothing to do, so a caller can
 * cheaply tell "this changed nothing" and skip the write.
 */
export function pauseSegments(segments: PracticeSegment[], now: Date): PracticeSegment[] {
  if (!isRunning(segments)) return segments;
  const next = segments.slice();
  next[next.length - 1] = { ...next[next.length - 1], stop: now.toISOString() };
  return next;
}

/** Resume: open a new segment. A no-op when one is already running. */
export function resumeSegments(segments: PracticeSegment[], now: Date): PracticeSegment[] {
  if (isRunning(segments)) return segments;
  return [...segments, { start: now.toISOString(), stop: null }];
}

/** The instant a session began — the first segment's start. */
export function sessionStart(segments: PracticeSegment[]): string | null {
  return segments[0]?.start ?? null;
}

/** When the running stretch began, or null if paused. */
export function runningSince(segments: PracticeSegment[]): string | null {
  return isRunning(segments) ? segments[segments.length - 1].start : null;
}

/**
 * Four hours. Past this, a running session is more likely forgotten than real.
 *
 * Not a cap — nothing is truncated, and a genuinely long session keeps counting.
 * It only decides when the modal offers to correct the total, which is the one
 * mechanism here that can tell a four-hour practice from a four-hour lunch,
 * because it asks.
 */
export const STALE_AFTER_MS = 4 * 60 * 60 * 1000;

/**
 * Has this session been running long enough that it's worth asking about?
 *
 * Two triggers, and both are about the **open segment** rather than the session
 * as a whole. A session that spans six hours because you practiced, paused, ate
 * dinner and came back is entirely normal; what isn't normal is one stretch of
 * uninterrupted play running that long.
 *
 * 1. The open segment has been running more than four hours.
 * 2. It began on a different effective day. Stale by definition however short it
 *    looks, and it uses the user's day boundary rather than midnight — a session
 *    started at 1am under a 4am boundary belongs to the previous day and has not
 *    crossed anything.
 *
 * A paused session is never stale: the clock isn't running, so nothing is
 * accumulating that could be wrong.
 */
export function isStale(
  segments: PracticeSegment[],
  now: Date,
  settings: TimeZoneSettings
): boolean {
  const since = runningSince(segments);
  if (!since) return false;

  const started = new Date(since);
  if (now.getTime() - started.getTime() > STALE_AFTER_MS) return true;

  return (
    getEffectiveDayForTimestamp(started, settings) !==
    getEffectiveDayForTimestamp(now, settings)
  );
}
