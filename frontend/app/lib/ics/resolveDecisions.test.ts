import { describe, it, expect } from 'vitest';
import {
  resolveDecisions,
  isFullyDecided,
  undecided,
  type StoredDecision,
} from './resolveDecisions';
import type { CalendarEventInstance } from './expandIcs';

/**
 * The resolution chain: instance → series → calendar → unset.
 *
 * The tier ordering is the whole design. If series didn't beat calendar, or
 * instance didn't beat series, you'd be re-deciding the same standup every week
 * — which is the friction that kills a weekly ritual.
 */

const CAL = 'cal-1';

function event(overrides: Partial<CalendarEventInstance> = {}): CalendarEventInstance {
  return {
    uid: 'standup@test',
    recurrenceId: '2026-01-12T09:00:00',
    title: 'Standup',
    allDay: false,
    start: '2026-01-12T09:00:00',
    end: '2026-01-12T09:15:00',
    ...overrides,
  };
}

function decision(overrides: Partial<StoredDecision> = {}): StoredDecision {
  return {
    documentId: 'd-1',
    uid: 'standup@test',
    recurrenceId: null,
    state: 'hide',
    calendarDocumentId: CAL,
    ...overrides,
  };
}

describe('resolveDecisions', () => {
  it('falls through to unset when nothing has been decided', () => {
    const [resolved] = resolveDecisions([event()], [], CAL, 'unset');

    expect(resolved.state).toBe('unset');
    expect(resolved.source).toBe('default');
  });

  it('applies a calendar default when there is no decision', () => {
    const [resolved] = resolveDecisions([event()], [], CAL, 'hide');

    expect(resolved).toMatchObject({ state: 'hide', source: 'calendar' });
  });

  it('lets a series decision beat the calendar default', () => {
    // The tier that carries the leverage: decide once on a recurring event and
    // it holds for every future instance.
    const [resolved] = resolveDecisions([event()], [decision({ state: 'show' })], CAL, 'hide');

    expect(resolved).toMatchObject({ state: 'show', source: 'series' });
  });

  it('lets an instance override beat its series', () => {
    const [resolved] = resolveDecisions(
      [event()],
      [
        decision({ state: 'hide' }),
        decision({
          documentId: 'd-2',
          recurrenceId: '2026-01-12T09:00:00',
          state: 'show',
        }),
      ],
      CAL,
      'unset'
    );

    expect(resolved).toMatchObject({ state: 'show', source: 'instance' });
  });

  it('applies a series decision to every future instance', () => {
    const week1 = event({ recurrenceId: '2026-01-12T09:00:00' });
    const week2 = event({ recurrenceId: '2026-01-19T09:00:00' });
    const week3 = event({ recurrenceId: '2026-01-26T09:00:00' });

    const resolved = resolveDecisions(
      [week1, week2, week3],
      [decision({ state: 'hide' })],
      CAL,
      'unset'
    );

    expect(resolved.map((r) => r.state)).toEqual(['hide', 'hide', 'hide']);
  });

  it('leaves other instances alone when one is overridden', () => {
    const resolved = resolveDecisions(
      [
        event({ recurrenceId: '2026-01-12T09:00:00' }),
        event({ recurrenceId: '2026-01-19T09:00:00' }),
      ],
      [
        decision({ state: 'hide' }),
        decision({ documentId: 'd-2', recurrenceId: '2026-01-19T09:00:00', state: 'show' }),
      ],
      CAL,
      'unset'
    );

    expect(resolved.map((r) => [r.state, r.source])).toEqual([
      ['hide', 'series'],
      ['show', 'instance'],
    ]);
  });

  it('treats a one-off event’s decision as chosen, not inherited', () => {
    // A non-recurring event stores its decision with a null recurrenceId, the
    // same shape a series uses. Reporting that as "series" would tell the user
    // it was inherited from somewhere, when they picked it directly.
    const [resolved] = resolveDecisions(
      [event({ recurrenceId: null })],
      [decision({ state: 'show' })],
      CAL,
      'unset'
    );

    expect(resolved.source).toBe('instance');
  });

  it('does not apply one event’s decision to another', () => {
    const resolved = resolveDecisions(
      [event({ uid: 'a@test' }), event({ uid: 'b@test' })],
      [decision({ uid: 'a@test', state: 'hide' })],
      CAL,
      'unset'
    );

    expect(resolved.map((r) => r.state)).toEqual(['hide', 'unset']);
  });
});

describe('completion', () => {
  it('is not finished while anything is unset', () => {
    const resolved = resolveDecisions(
      [event({ uid: 'a@test' }), event({ uid: 'b@test' })],
      [decision({ uid: 'a@test' })],
      CAL,
      'unset'
    );

    expect(isFullyDecided(resolved)).toBe(false);
    expect(undecided(resolved).map((r) => r.uid)).toEqual(['b@test']);
  });

  it('is finished once every instance has a state', () => {
    const resolved = resolveDecisions([event()], [decision()], CAL, 'unset');

    expect(isFullyDecided(resolved)).toBe(true);
    expect(undecided(resolved)).toEqual([]);
  });

  it('is trivially finished for an empty week', () => {
    expect(isFullyDecided([])).toBe(true);
  });
});
