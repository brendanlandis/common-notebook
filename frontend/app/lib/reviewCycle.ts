import { Temporal } from 'temporal-polyfill';
import type { RecurrenceRule, RecurrenceAnchor } from '../types/index';
import { calculateNextRecurrence } from './recurrence';
import { getTodayForRecurrence, toISODate } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Turning a review *cadence* into the *period* a review covers.
 *
 * A review is stored against an explicit `periodStart`/`periodEnd` range rather
 * than a week key, because three things we want are all the same operation once
 * it's a range: planning on Sunday night for a Monday-start week, re-running a
 * review on Thursday for the rest of the current week, and (later) swapping the
 * weekly cadence for a lunar, monthly, or seasonal one. Only the boundaries
 * change; nothing downstream does.
 *
 * The cadence is a `RecurrenceRule` — the same pattern language tasks use, via
 * the same engine (`calculateNextRecurrence`). That reuse is the point: "the
 * last Friday of the month" and "the next new moon" are genuinely hard to get
 * right across timezones and month lengths, and this file having its own
 * opinion about them is how the two would drift apart.
 */

export interface ReviewPeriod {
  /** YYYY-MM-DD, inclusive. */
  periodStart: string;
  /** YYYY-MM-DD, inclusive. */
  periodEnd: string;
}

/**
 * How much of the cycle a review is being conducted for.
 *
 * - `upcoming` — the next whole cycle. Sunday-night planning for a Monday week.
 * - `remainder` — today through the end of the current cycle. Re-reviewing on a
 *   Thursday, for the rest of that week.
 */
export type ReviewPeriodMode = 'upcoming' | 'remainder';

export interface ReviewPeriodOptions {
  mode?: ReviewPeriodMode;
  /**
   * The cadence's phase anchor. Required by biweekly, which is the only shape
   * whose rule doesn't determine which occurrence it lands on; ignored by the
   * rest.
   */
  anchorDate?: string | null;
}

/** Cadences whose boundaries are a fixed number of days apart. */
const FIXED_STRIDE_DAYS: Partial<Record<string, number>> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
};

const shift = (iso: string, days: number): string =>
  Temporal.PlainDate.from(iso).add({ days }).toString();

/**
 * The next cadence boundary on or after today, as YYYY-MM-DD.
 *
 * Delegates to the task recurrence engine, which resolves "today" through the
 * user's day-boundary hour and does all the calendar and astronomical work.
 * Returns null for a rule the engine can't satisfy — a cadence with a missing
 * required field, or one that isn't recurring at all.
 *
 * `anchorDate` is only meaningful for biweekly (see below); every other cadence
 * derives its phase from the rule itself.
 */
export function nextBoundary(
  rule: RecurrenceRule,
  settings: TimeZoneSettings,
  anchorDate: string | null = null
): string | null {
  if (rule.recurrenceType === 'biweekly') {
    // Biweekly is the one cadence with free phase: "every other Monday" doesn't
    // say *which* Monday, so it needs a stored anchor. A task gets that for free
    // from the occurrence it just completed; a review cadence has no completion,
    // which is why `anchorDate` exists on the schema.
    //
    // Not delegated, because the engine's biweekly branch is a do/while that
    // always adds 14 — correct for "I just finished one", wrong here, where an
    // anchor still in the future *is* the next boundary. Three lines of stride
    // arithmetic; the hard cadences below still go through the engine.
    if (!anchorDate) return null;
    const today = Temporal.PlainDate.from(
      toISODate(getTodayForRecurrence(settings), settings)
    );
    let boundary = Temporal.PlainDate.from(anchorDate);
    while (Temporal.PlainDate.compare(boundary, today) < 0) {
      boundary = boundary.add({ days: 14 });
    }
    return boundary.toString();
  }

  const anchor: RecurrenceRule & RecurrenceAnchor = {
    ...rule,
    dueDate: null,
    displayDate: anchorDate,
    displayDateOffset: null,
  };
  // `isInitialCreation: false` means "the occurrence after this one", which is
  // what a boundary is. The `true` branch answers "show it today", which would
  // put a daily or every-x-days cadence's boundary on today itself.
  const { dueDate, displayDate } = calculateNextRecurrence(anchor, settings, false);
  // Event-based types put the date in dueDate only when an offset pushes the
  // display earlier; with no offset it lands in displayDate. Either is the
  // boundary.
  return dueDate ?? displayDate;
}

/**
 * The boundary after `boundary`.
 *
 * Fixed-stride cadences are plain arithmetic. Everything else — the monthly
 * shapes, the moons, the seasons — is asked of the engine again, anchored on the
 * first boundary: `calculateEventDate` compares against
 * `max(anchor, today)`, so a future anchor makes it answer "the next one after
 * *that*" rather than "the next one after today".
 *
 * That anchoring trick does not work for the weekday cadences, which ignore the
 * anchor and always resolve relative to today — hence the stride table rather
 * than one uniform path.
 */
function boundaryAfter(
  rule: RecurrenceRule,
  boundary: string,
  settings: TimeZoneSettings
): string | null {
  const stride = FIXED_STRIDE_DAYS[rule.recurrenceType];
  if (stride !== undefined) return shift(boundary, stride);

  if (rule.recurrenceType === 'every x days') {
    return rule.recurrenceInterval ? shift(boundary, rule.recurrenceInterval) : null;
  }

  const { dueDate, displayDate } = calculateNextRecurrence(
    { ...rule, dueDate: null, displayDate: boundary, displayDateOffset: null },
    settings,
    false
  );
  return dueDate ?? displayDate;
}

/**
 * The period a review conducted now should cover.
 *
 * Both modes are half-open in the same way: a period runs up to, but not
 * including, the boundary that starts the next one. A Monday-start weekly
 * cadence therefore gives Monday–Sunday, not Monday–Monday.
 *
 * Returns null when the cadence can't produce boundaries (not recurring, or
 * missing a field its type requires) — the caller should treat that as "no
 * cadence configured" rather than falling back to a guess, because a guessed
 * period would be silently stored on a real review.
 */
export function computeReviewPeriod(
  rule: RecurrenceRule,
  settings: TimeZoneSettings,
  { mode = 'upcoming', anchorDate = null }: ReviewPeriodOptions = {}
): ReviewPeriod | null {
  if (!rule.isRecurring || rule.recurrenceType === 'none') return null;

  const first = nextBoundary(rule, settings, anchorDate);
  if (!first) return null;

  if (mode === 'remainder') {
    const today = toISODate(getTodayForRecurrence(settings), settings);
    // Today up to the day before the next cycle starts. When today *is* the
    // boundary the engine has already moved past it, so this still spans a whole
    // cycle rather than collapsing to nothing.
    return { periodStart: today, periodEnd: shift(first, -1) };
  }

  const second = boundaryAfter(rule, first, settings);
  if (!second) return null;

  return { periodStart: first, periodEnd: shift(second, -1) };
}
