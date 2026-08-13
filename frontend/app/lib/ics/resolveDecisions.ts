import type { CalendarEventInstance } from './expandIcs';

/**
 * Resolving what state an event instance is in.
 *
 * The decision is per-instance, but the *default* resolves through a chain:
 *
 *     instance override  →  series default  →  calendar default  →  unset
 *
 * That shape is the difference between a ritual that survives and one that
 * doesn't. Pure per-instance means re-deciding the same standup every week,
 * which is the friction that kills a weekly review by about week five. The
 * series tier carries most of the leverage, because recurring events are both
 * the bulk of a calendar and the bulk of the noise: decide once on a standup and
 * it holds for every future instance until some specific instance overrides it.
 *
 * `unset` is a real state, not a silent default — the review is finished when
 * nothing is unset, which is a definition of done that falls out of the data
 * model for free. Weekly reviews normally have no completion condition, so you
 * fiddle indefinitely or quit early.
 */

export type EventState = 'show' | 'hide' | 'unset';

export interface StoredDecision {
  documentId: string;
  uid: string;
  /** null means the decision applies to the whole series. */
  recurrenceId: string | null;
  state: 'show' | 'hide';
  calendarDocumentId: string;
}

export interface ResolvedInstance extends CalendarEventInstance {
  state: EventState;
  /** Which tier decided it — the UI shows an inherited state differently from a chosen one. */
  source: 'instance' | 'series' | 'calendar' | 'default';
  calendarDocumentId: string;
}

/**
 * Index decisions for lookup. Keyed by uid and, for instance overrides, by
 * uid + recurrenceId — the pair that identifies one occurrence and survives a
 * re-poll, since Google keeps `uid` stable across ICS refreshes.
 */
function index(decisions: StoredDecision[]) {
  const series = new Map<string, StoredDecision>();
  const instances = new Map<string, StoredDecision>();
  for (const decision of decisions) {
    if (decision.recurrenceId === null) series.set(decision.uid, decision);
    else instances.set(`${decision.uid}::${decision.recurrenceId}`, decision);
  }
  return { series, instances };
}

export function resolveDecisions(
  events: CalendarEventInstance[],
  decisions: StoredDecision[],
  calendarDocumentId: string,
  calendarDefault: EventState
): ResolvedInstance[] {
  const { series, instances } = index(decisions);

  return events.map((event) => {
    const override =
      event.recurrenceId !== null
        ? instances.get(`${event.uid}::${event.recurrenceId}`)
        : undefined;
    if (override) {
      return { ...event, state: override.state, source: 'instance', calendarDocumentId };
    }

    const seriesDecision = series.get(event.uid);
    if (seriesDecision) {
      return {
        ...event,
        state: seriesDecision.state,
        // A non-recurring event's only decision is stored with a null
        // recurrenceId too, so it reads as its own "series" of one. Reporting
        // that as `instance` keeps the UI honest: it was decided directly, not
        // inherited from anywhere.
        source: event.recurrenceId === null ? 'instance' : 'series',
        calendarDocumentId,
      };
    }

    if (calendarDefault !== 'unset') {
      return { ...event, state: calendarDefault, source: 'calendar', calendarDocumentId };
    }

    return { ...event, state: 'unset', source: 'default', calendarDocumentId };
  });
}

/**
 * Whether the week's bounce is finished — nothing left undecided.
 *
 * This is the review's completion condition, and the reason `unset` is modelled
 * rather than defaulted away.
 */
export function isFullyDecided(instances: ResolvedInstance[]): boolean {
  return instances.every((instance) => instance.state !== 'unset');
}

/** The instances still needing a decision, in the order they appear in the week. */
export function undecided(instances: ResolvedInstance[]): ResolvedInstance[] {
  return instances.filter((instance) => instance.state === 'unset');
}
