import type { RecurrenceRule, RecurrenceType } from '../types/index';
import { getDefault } from './defaultSettings';

/**
 * How often the review happens, as a stored setting.
 *
 * The cadence is a `RecurrenceRule` — the same pattern language tasks speak —
 * plus a phase anchor. It lives in a single `system-setting` row as JSON rather
 * than one row per field, which is the opposite of the advice for calendar
 * subscriptions and deliberately so: a subscription *list* needs to be appended
 * to and edited item-by-item against a store with no compare-and-set, whereas a
 * cadence is one indivisible value, written whole, by one user, from one form.
 * Eight rows and eight round-trips would buy nothing.
 *
 * The setting is a string, so everything here is defensive: a hand-edited or
 * half-written value must degrade to the default rather than throw inside a
 * settings panel.
 */

export interface ReviewCadence extends RecurrenceRule {
  /**
   * The phase anchor. Only biweekly needs one — "every other Monday" doesn't say
   * which Monday, and unlike a task there is no completed occurrence to infer it
   * from. See `reviewCycle.nextBoundary`.
   */
  anchorDate: string | null;
}

export const REVIEW_CADENCE_SETTING = 'reviewCadence';

const BLANK: ReviewCadence = {
  isRecurring: true,
  recurrenceType: 'weekly',
  recurrenceInterval: null,
  recurrenceDayOfWeek: 1, // Monday
  recurrenceDayOfMonth: null,
  recurrenceWeekOfMonth: null,
  recurrenceDayOfWeekMonthly: null,
  recurrenceMonth: null,
  anchorDate: null,
};

/** The cadence a user has before they've chosen one: weekly, starting Monday. */
export function defaultReviewCadence(): ReviewCadence {
  return parseReviewCadence(getDefault(REVIEW_CADENCE_SETTING));
}

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Read a stored cadence, falling back to the default on anything unusable.
 *
 * Never throws. A settings panel that cannot render because one row holds
 * malformed JSON is worse than one showing the default.
 */
export function parseReviewCadence(value: string | null | undefined): ReviewCadence {
  if (!value) return { ...BLANK };

  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...BLANK };
    raw = parsed as Record<string, unknown>;
  } catch {
    return { ...BLANK };
  }

  return {
    isRecurring: true,
    recurrenceType:
      typeof raw.recurrenceType === 'string'
        ? (raw.recurrenceType as RecurrenceType)
        : BLANK.recurrenceType,
    recurrenceInterval: asNumber(raw.recurrenceInterval),
    recurrenceDayOfWeek: asNumber(raw.recurrenceDayOfWeek),
    recurrenceDayOfMonth: asNumber(raw.recurrenceDayOfMonth),
    recurrenceWeekOfMonth: asNumber(raw.recurrenceWeekOfMonth),
    recurrenceDayOfWeekMonthly: asNumber(raw.recurrenceDayOfWeekMonthly),
    recurrenceMonth: asNumber(raw.recurrenceMonth),
    anchorDate: typeof raw.anchorDate === 'string' ? raw.anchorDate : null,
  };
}

/** Serialize for storage. Drops `isRecurring`, which is always true for a cadence. */
export function serializeReviewCadence(cadence: ReviewCadence): string {
  const { isRecurring: _isRecurring, ...stored } = cadence;
  return JSON.stringify(stored);
}

/**
 * Whether this cadence can actually produce a period.
 *
 * Mirrors what `computeReviewPeriod` will accept, so the settings UI can say so
 * up front instead of saving a cadence that silently yields no review — the
 * biweekly-without-an-anchor case, which would otherwise look saved and then
 * produce nothing.
 */
export function cadenceIsUsable(cadence: ReviewCadence): boolean {
  switch (cadence.recurrenceType) {
    case 'biweekly':
      return cadence.recurrenceDayOfWeek !== null && cadence.anchorDate !== null;
    case 'weekly':
      return cadence.recurrenceDayOfWeek !== null;
    case 'every x days':
      return cadence.recurrenceInterval !== null;
    case 'monthly date':
      return cadence.recurrenceDayOfMonth !== null;
    case 'monthly day':
      return (
        cadence.recurrenceWeekOfMonth !== null && cadence.recurrenceDayOfWeekMonthly !== null
      );
    case 'annually':
      return cadence.recurrenceMonth !== null && cadence.recurrenceDayOfMonth !== null;
    case 'none':
      return false;
    default:
      // The astronomical cadences need no fields at all.
      return true;
  }
}
