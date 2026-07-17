import * as Astronomy from 'astronomy-engine';
import { getToday, toISODate } from './dateUtils';
import type { TimeZoneSettings } from './timeZoneSettings';

/**
 * Moon phase icon component names (mapped to our custom Weather Icons components)
 */
export type MoonPhaseIconName =
  | 'WiMoonNew'
  | 'WiMoonWaxingCrescent1'
  | 'WiMoonWaxingCrescent2'
  | 'WiMoonWaxingCrescent3'
  | 'WiMoonWaxingCrescent4'
  | 'WiMoonWaxingCrescent5'
  | 'WiMoonWaxingCrescent6'
  | 'WiMoonFirstQuarter'
  | 'WiMoonWaxingGibbous1'
  | 'WiMoonWaxingGibbous2'
  | 'WiMoonWaxingGibbous3'
  | 'WiMoonWaxingGibbous4'
  | 'WiMoonWaxingGibbous5'
  | 'WiMoonWaxingGibbous6'
  | 'WiMoonFull'
  | 'WiMoonWaningGibbous1'
  | 'WiMoonWaningGibbous2'
  | 'WiMoonWaningGibbous3'
  | 'WiMoonWaningGibbous4'
  | 'WiMoonWaningGibbous5'
  | 'WiMoonWaningGibbous6'
  | 'WiMoonThirdQuarter'
  | 'WiMoonWaningCrescent1'
  | 'WiMoonWaningCrescent2'
  | 'WiMoonWaningCrescent3'
  | 'WiMoonWaningCrescent4'
  | 'WiMoonWaningCrescent5'
  | 'WiMoonWaningCrescent6';

/**
 * Check if a major phase transition occurs today
 * @returns The major phase (0, 90, 180, or 270) that transitions today, or null if none
 */
function getPhaseTransitionToday(settings: TimeZoneSettings): number | null {
  const today = getToday(settings);
  
  // Get tomorrow's start (end of today's range)
  const tomorrowStart = new Date(today);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  
  // Check each major phase (new moon, first quarter, full moon, third quarter)
  const majorPhases = [0, 90, 180, 270];
  
  for (const phase of majorPhases) {
    // Search for this phase occurring within today
    const phaseEvent = Astronomy.SearchMoonPhase(phase, today, 1);
    
    if (phaseEvent) {
      // Compare the phase event date with today's date in EST
      const phaseDate = new Date(phaseEvent.date);
      // Check if the phase occurs today by comparing if both are on the same calendar day
      if (phaseDate >= today && phaseDate < tomorrowStart) {
        return phase;
      }
    }
  }
  
  return null;
}

/**
 * Get the current moon phase icon component name based on the moon phase angle
 * @param date - Optional date to calculate phase for (defaults to current time)
 * @returns The component name for the appropriate moon phase icon
 */
export function getMoonPhaseIconName(settings: TimeZoneSettings, date?: Date): MoonPhaseIconName {
  // Check if a major phase transition occurs today
  // If so, use that phase for the entire day (matches app reset logic)
  const phaseToday = getPhaseTransitionToday(settings);
  if (phaseToday !== null) {
    if (phaseToday === 0) {
      return 'WiMoonNew';
    }
    if (phaseToday === 90) {
      return 'WiMoonFirstQuarter';
    }
    if (phaseToday === 180) {
      return 'WiMoonFull';
    }
    if (phaseToday === 270) {
      return 'WiMoonThirdQuarter';
    }
  }

  // No major phase transition today, use current time to determine phase
  const targetDate = date || new Date();
  const phaseAngle = Astronomy.MoonPhase(targetDate);

  // Handle exact phase points first
  if (phaseAngle === 0 || phaseAngle === 360) {
    return 'WiMoonNew';
  }
  if (phaseAngle === 90) {
    return 'WiMoonFirstQuarter';
  }
  if (phaseAngle === 180) {
    return 'WiMoonFull';
  }
  if (phaseAngle === 270) {
    return 'WiMoonThirdQuarter';
  }

  // Map phase angle to icon (each quadrant divided into 6 sub-phases of 15° each)
  if (phaseAngle > 0 && phaseAngle < 90) {
    // Waxing Crescent: 0-90° → WiMoonWaxingCrescent1-6
    const index = Math.ceil(phaseAngle / 15);
    return `WiMoonWaxingCrescent${index}` as MoonPhaseIconName;
  }

  if (phaseAngle > 90 && phaseAngle < 180) {
    // Waxing Gibbous: 90-180° → WiMoonWaxingGibbous1-6
    const index = Math.ceil((phaseAngle - 90) / 15);
    return `WiMoonWaxingGibbous${index}` as MoonPhaseIconName;
  }

  if (phaseAngle > 180 && phaseAngle < 270) {
    // Waning Gibbous: 180-270° → WiMoonWaningGibbous1-6
    const index = Math.ceil((phaseAngle - 180) / 15);
    return `WiMoonWaningGibbous${index}` as MoonPhaseIconName;
  }

  // Waning Crescent: 270-360° → WiMoonWaningCrescent1-6
  const index = Math.ceil((phaseAngle - 270) / 15);
  return `WiMoonWaningCrescent${index}` as MoonPhaseIconName;
}

/**
 * Has a new moon fallen in `(since, today]`?
 *
 * `since` is the declutter **watermark** — the day we started watching. It is
 * required, and that is the whole point: an earlier version accepted
 * `Date | null` and answered a missing watermark by searching back 30 days for
 * a new moon. The lunar month is 29.53 days, so that window always contains
 * one, and the answer was always "yes" — every account that had never
 * decluttered decluttered instantly, which is exactly what enabling
 * auto-declutter is not supposed to do. There is no sensible answer to "has a
 * new moon passed since nothing?", so callers must arm a watermark first and
 * the type no longer lets them ask.
 *
 * Searching forward from the day after `since` is what preserves catch-up: a
 * moon that passed while the app went unused still counts as owed.
 */
export function hasNewMoonSince(since: Date, settings: TimeZoneSettings): boolean {
  const today = getToday(settings);

  // From the day after the watermark — a moon on the watermark day itself was
  // already accounted for by whatever set it.
  const searchStart = new Date(since);
  searchStart.setDate(searchStart.getDate() + 1);

  const nextNewMoon = Astronomy.SearchMoonPhase(0, searchStart, 40);
  if (!nextNewMoon) {
    return false;
  }

  // Compare calendar days in the user's zone, not instants. `today` is midnight,
  // so `isAfter(newMoon, today)` excluded a new moon falling later on this very
  // day and pushed the declutter to the day *after* the moon it was named for.
  // Both operands are real instants, which is what toISODate expects.
  const newMoonDate = new Date(nextNewMoon.date);
  return toISODate(newMoonDate, settings) <= toISODate(today, settings);
}
