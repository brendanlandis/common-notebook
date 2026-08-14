import { describe, it, expect } from 'vitest';
import {
  parseSegments,
  isRunning,
  elapsedMs,
  durationMinutes,
  pauseSegments,
  resumeSegments,
  sessionStart,
  runningSince,
  isStale,
  STALE_AFTER_MS,
  type PracticeSegment,
} from './practiceSession';
import type { TimeZoneSettings } from './timeZoneSettings';

// A real zone with a real offset, deliberately not the machine's. The suite runs
// under `npm run test:zones` in UTC, New York and Kolkata, and none of these
// assertions may depend on which one it got.
const EST: TimeZoneSettings = { timezone: 'America/New_York', dayBoundaryHour: 4 };

const at = (iso: string) => new Date(iso);

describe('parseSegments', () => {
  it('reads a well-formed array', () => {
    const value = [
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:30:00.000Z' },
      { start: '2026-08-14T15:00:00.000Z', stop: null },
    ];
    expect(parseSegments(value)).toEqual(value);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'guitar'],
    ['a number', 42],
    ['an object', { start: '2026-08-14T14:00:00.000Z' }],
  ])('returns nothing for %s — a JSON column can hold anything', (_label, value) => {
    expect(parseSegments(value)).toEqual([]);
  });

  it('drops entries with no usable start', () => {
    const value = [
      { start: 'not a date', stop: null },
      { stop: '2026-08-14T14:30:00.000Z' },
      null,
      'nonsense',
      { start: '2026-08-14T15:00:00.000Z', stop: null },
    ];
    expect(parseSegments(value)).toEqual([{ start: '2026-08-14T15:00:00.000Z', stop: null }]);
  });

  it('drops an entry whose stop is unparseable rather than treating it as open', () => {
    // Treating it as open would make a finished session look like it is still
    // running, which the modal would then put on screen over the whole app.
    expect(parseSegments([{ start: '2026-08-14T14:00:00.000Z', stop: 'garbage' }])).toEqual([]);
  });

  it('collapses a backwards segment instead of letting it eat time', () => {
    const parsed = parseSegments([
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T13:00:00.000Z' },
    ]);
    expect(parsed).toEqual([
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:00:00.000Z' },
    ]);
    expect(elapsedMs(parsed, at('2026-08-14T16:00:00.000Z'))).toBe(0);
  });

  it('closes an open segment that is not last, at the next one’s start', () => {
    // Only the last may be open. A middle one left open means a write landed out
    // of order, and counting it to `now` would double-count everything after it.
    expect(
      parseSegments([
        { start: '2026-08-14T14:00:00.000Z', stop: null },
        { start: '2026-08-14T15:00:00.000Z', stop: null },
      ])
    ).toEqual([
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T15:00:00.000Z' },
      { start: '2026-08-14T15:00:00.000Z', stop: null },
    ]);
  });
});

describe('isRunning', () => {
  it('is false for an empty session', () => {
    expect(isRunning([])).toBe(false);
  });

  it('is true only when the last segment is open', () => {
    expect(isRunning([{ start: '2026-08-14T14:00:00.000Z', stop: null }])).toBe(true);
    expect(
      isRunning([{ start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:30:00.000Z' }])
    ).toBe(false);
  });
});

describe('elapsedMs / durationMinutes', () => {
  const segments: PracticeSegment[] = [
    { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' }, // 20 min
    { start: '2026-08-14T15:00:00.000Z', stop: '2026-08-14T15:05:00.000Z' }, // 5 min
  ];

  it('sums the closed segments and ignores the gaps between them', () => {
    // An hour and five minutes of wall time; twenty-five minutes practiced. This
    // is the whole reason `duration` cannot be `stop - start`.
    expect(durationMinutes(segments, at('2026-08-14T16:00:00.000Z'))).toBe(25);
  });

  it('counts an open segment up to now', () => {
    const running = [...segments, { start: '2026-08-14T16:00:00.000Z', stop: null }];
    expect(durationMinutes(running, at('2026-08-14T16:10:00.000Z'))).toBe(35);
  });

  it('rounds to the nearest minute', () => {
    const short: PracticeSegment[] = [
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:02:30.000Z' },
    ];
    expect(durationMinutes(short, at('2026-08-14T15:00:00.000Z'))).toBe(3);
  });

  it('is zero for a session with no segments', () => {
    expect(elapsedMs([], at('2026-08-14T16:00:00.000Z'))).toBe(0);
  });
});

describe('pause and resume are idempotent', () => {
  const now = at('2026-08-14T15:00:00.000Z');
  const running: PracticeSegment[] = [{ start: '2026-08-14T14:00:00.000Z', stop: null }];
  const paused: PracticeSegment[] = [
    { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:30:00.000Z' },
  ];

  it('pause closes the open segment', () => {
    expect(pauseSegments(running, now)).toEqual([
      { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T15:00:00.000Z' },
    ]);
  });

  it('pausing an already-paused session changes nothing', () => {
    // The same reference, so a caller can skip the write entirely. This is what
    // makes a stale second device harmless rather than destructive.
    expect(pauseSegments(paused, now)).toBe(paused);
  });

  it('resume opens a new segment', () => {
    expect(resumeSegments(paused, now)).toEqual([
      ...paused,
      { start: '2026-08-14T15:00:00.000Z', stop: null },
    ]);
  });

  it('resuming an already-running session changes nothing', () => {
    expect(resumeSegments(running, now)).toBe(running);
  });

  it('survives pause/pause/resume/resume in any order', () => {
    let segments = resumeSegments([], now);
    segments = resumeSegments(segments, at('2026-08-14T15:01:00.000Z'));
    expect(segments).toHaveLength(1);

    segments = pauseSegments(segments, at('2026-08-14T15:10:00.000Z'));
    segments = pauseSegments(segments, at('2026-08-14T15:20:00.000Z'));
    expect(segments).toHaveLength(1);
    // The second pause must not move the stop time it already wrote.
    expect(segments[0].stop).toBe('2026-08-14T15:10:00.000Z');
    expect(durationMinutes(segments, at('2026-08-14T16:00:00.000Z'))).toBe(10);
  });
});

describe('sessionStart / runningSince', () => {
  it('sessionStart is the first segment, however many there are', () => {
    expect(
      sessionStart([
        { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' },
        { start: '2026-08-14T15:00:00.000Z', stop: null },
      ])
    ).toBe('2026-08-14T14:00:00.000Z');
  });

  it('runningSince is the open segment, or null when paused', () => {
    expect(
      runningSince([
        { start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' },
        { start: '2026-08-14T15:00:00.000Z', stop: null },
      ])
    ).toBe('2026-08-14T15:00:00.000Z');
    expect(
      runningSince([{ start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' }])
    ).toBeNull();
  });

  it('both are null for an empty session', () => {
    expect(sessionStart([])).toBeNull();
    expect(runningSince([])).toBeNull();
  });
});

describe('isStale', () => {
  it('is false for a paused session, however old', () => {
    // Nothing is accumulating, so nothing can be wrong.
    const paused: PracticeSegment[] = [
      { start: '2026-08-10T14:00:00.000Z', stop: '2026-08-10T14:30:00.000Z' },
    ];
    expect(isStale(paused, at('2026-08-14T14:00:00.000Z'), EST)).toBe(false);
  });

  it('is false for a session running less than four hours', () => {
    const running: PracticeSegment[] = [{ start: '2026-08-14T14:00:00.000Z', stop: null }];
    expect(isStale(running, at('2026-08-14T17:59:00.000Z'), EST)).toBe(false);
  });

  it('is true past four hours', () => {
    const running: PracticeSegment[] = [{ start: '2026-08-14T14:00:00.000Z', stop: null }];
    const justOver = new Date(Date.parse('2026-08-14T14:00:00.000Z') + STALE_AFTER_MS + 1000);
    expect(isStale(running, justOver, EST)).toBe(true);
  });

  it('measures the open stretch, not the whole session', () => {
    // Practiced at 9am, paused, came back at 8pm. Eleven hours of session, ten
    // minutes of running — nothing to ask about.
    const segments: PracticeSegment[] = [
      { start: '2026-08-14T13:00:00.000Z', stop: '2026-08-14T13:30:00.000Z' },
      { start: '2026-08-15T00:00:00.000Z', stop: null },
    ];
    expect(isStale(segments, at('2026-08-15T00:10:00.000Z'), EST)).toBe(false);
  });

  it('is true once the open stretch crosses the day boundary, however short', () => {
    // 03:30 EST is still the 14th under a 4am boundary; 04:30 is the 15th. Half
    // an hour of running, but it has crossed — and the session's `date` column
    // now disagrees with the day it is finishing in.
    const running: PracticeSegment[] = [{ start: '2026-08-15T07:30:00.000Z', stop: null }];
    expect(isStale(running, at('2026-08-15T08:30:00.000Z'), EST)).toBe(true);
  });

  it('does not fire at midnight, which is not the boundary', () => {
    // 23:30 → 00:30 EST crosses the calendar day but not the 4am boundary, so
    // both instants are still the 14th and there is nothing stale about it.
    const running: PracticeSegment[] = [{ start: '2026-08-15T03:30:00.000Z', stop: null }];
    expect(isStale(running, at('2026-08-15T04:30:00.000Z'), EST)).toBe(false);
  });
});
