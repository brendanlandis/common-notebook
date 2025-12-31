import * as Astronomy from 'astronomy-engine';
import { getTodayInEST, toISODateInEST } from './dateUtils';
import { isAfter } from 'date-fns';

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
function getPhaseTransitionToday(): number | null {
  const today = getTodayInEST();
  
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
export function getMoonPhaseIconName(date?: Date): MoonPhaseIconName {
  // Check if a major phase transition occurs today
  // If so, use that phase for the entire day (matches app reset logic)
  const phaseToday = getPhaseTransitionToday();
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
 * Check if a new moon has occurred since a given date
 * @param lastResetDate - The date to check from (can be null for first run)
 * @returns true if a new moon has occurred since the last reset date (including today)
 */
export function hasNewMoonSinceDate(lastResetDate: Date | null): boolean {
  const today = getTodayInEST();
  
  // If no previous reset date, check if there's been a new moon today or recently
  // Search backwards from today to find the most recent new moon
  if (!lastResetDate) {
    // Search backwards from today (go back 30 days to find recent new moon)
    const searchStartDate = new Date(today);
    searchStartDate.setDate(searchStartDate.getDate() - 30);
    
    const recentNewMoon = Astronomy.SearchMoonPhase(0, searchStartDate, 30);
    if (!recentNewMoon) {
      return false;
    }
    
    // Check if the new moon occurred today or in the past
    const newMoonDate = new Date(recentNewMoon.date);
    return !isAfter(newMoonDate, today);
  }

  // Search for new moons starting from the day after the last reset
  // We want to find if there's been a new moon since (but not including) the reset day
  const searchStart = new Date(lastResetDate);
  searchStart.setDate(searchStart.getDate() + 1);
  
  // Search forward from the day after reset to find the next new moon
  const nextNewMoon = Astronomy.SearchMoonPhase(0, searchStart, 40);
  
  if (!nextNewMoon) {
    return false;
  }
  
  // Check if the new moon occurred on or before today
  const newMoonDate = new Date(nextNewMoon.date);
  return !isAfter(newMoonDate, today);
}
