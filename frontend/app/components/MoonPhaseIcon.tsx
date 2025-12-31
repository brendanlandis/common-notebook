'use client';

import { useState, useEffect } from 'react';
import { getMoonPhaseIconName, type MoonPhaseIconName } from '../lib/moonPhase';
import { useTimezoneContext } from '../contexts/TimezoneContext';
import {
  MoonNew,
  MoonWaxingCrescent1,
  MoonWaxingCrescent2,
  MoonWaxingCrescent3,
  MoonWaxingCrescent4,
  MoonWaxingCrescent5,
  MoonWaxingCrescent6,
  MoonFirstQuarter,
  MoonWaxingGibbous1,
  MoonWaxingGibbous2,
  MoonWaxingGibbous3,
  MoonWaxingGibbous4,
  MoonWaxingGibbous5,
  MoonWaxingGibbous6,
  MoonFull,
  MoonWaningGibbous1,
  MoonWaningGibbous2,
  MoonWaningGibbous3,
  MoonWaningGibbous4,
  MoonWaningGibbous5,
  MoonWaningGibbous6,
  MoonThirdQuarter,
  MoonWaningCrescent1,
  MoonWaningCrescent2,
  MoonWaningCrescent3,
  MoonWaningCrescent4,
  MoonWaningCrescent5,
  MoonWaningCrescent6,
} from './MoonPhaseIcons';

interface MoonPhaseIconProps {
  size?: number;
  className?: string;
}

/**
 * Convert moon phase icon name to lowercase, human-readable string
 */
function getMoonPhaseTitle(iconName: MoonPhaseIconName): string {
  const titleMap: Record<MoonPhaseIconName, string> = {
    WiMoonNew: 'new moon',
    WiMoonWaxingCrescent1: 'waxing crescent',
    WiMoonWaxingCrescent2: 'waxing crescent',
    WiMoonWaxingCrescent3: 'waxing crescent',
    WiMoonWaxingCrescent4: 'waxing crescent',
    WiMoonWaxingCrescent5: 'waxing crescent',
    WiMoonWaxingCrescent6: 'waxing crescent',
    WiMoonFirstQuarter: 'first quarter',
    WiMoonWaxingGibbous1: 'waxing gibbous',
    WiMoonWaxingGibbous2: 'waxing gibbous',
    WiMoonWaxingGibbous3: 'waxing gibbous',
    WiMoonWaxingGibbous4: 'waxing gibbous',
    WiMoonWaxingGibbous5: 'waxing gibbous',
    WiMoonWaxingGibbous6: 'waxing gibbous',
    WiMoonFull: 'full moon',
    WiMoonWaningGibbous1: 'waning gibbous',
    WiMoonWaningGibbous2: 'waning gibbous',
    WiMoonWaningGibbous3: 'waning gibbous',
    WiMoonWaningGibbous4: 'waning gibbous',
    WiMoonWaningGibbous5: 'waning gibbous',
    WiMoonWaningGibbous6: 'waning gibbous',
    WiMoonThirdQuarter: 'third quarter',
    WiMoonWaningCrescent1: 'waning crescent',
    WiMoonWaningCrescent2: 'waning crescent',
    WiMoonWaningCrescent3: 'waning crescent',
    WiMoonWaningCrescent4: 'waning crescent',
    WiMoonWaningCrescent5: 'waning crescent',
    WiMoonWaningCrescent6: 'waning crescent',
  };
  
  return titleMap[iconName] || 'new moon';
}

// Map component names to actual components
const moonPhaseComponents: Record<MoonPhaseIconName, React.ComponentType<{ size?: number; className?: string }>> = {
  WiMoonNew: MoonNew,
  WiMoonWaxingCrescent1: MoonWaxingCrescent1,
  WiMoonWaxingCrescent2: MoonWaxingCrescent2,
  WiMoonWaxingCrescent3: MoonWaxingCrescent3,
  WiMoonWaxingCrescent4: MoonWaxingCrescent4,
  WiMoonWaxingCrescent5: MoonWaxingCrescent5,
  WiMoonWaxingCrescent6: MoonWaxingCrescent6,
  WiMoonFirstQuarter: MoonFirstQuarter,
  WiMoonWaxingGibbous1: MoonWaxingGibbous1,
  WiMoonWaxingGibbous2: MoonWaxingGibbous2,
  WiMoonWaxingGibbous3: MoonWaxingGibbous3,
  WiMoonWaxingGibbous4: MoonWaxingGibbous4,
  WiMoonWaxingGibbous5: MoonWaxingGibbous5,
  WiMoonWaxingGibbous6: MoonWaxingGibbous6,
  WiMoonFull: MoonFull,
  WiMoonWaningGibbous1: MoonWaningGibbous1,
  WiMoonWaningGibbous2: MoonWaningGibbous2,
  WiMoonWaningGibbous3: MoonWaningGibbous3,
  WiMoonWaningGibbous4: MoonWaningGibbous4,
  WiMoonWaningGibbous5: MoonWaningGibbous5,
  WiMoonWaningGibbous6: MoonWaningGibbous6,
  WiMoonThirdQuarter: MoonThirdQuarter,
  WiMoonWaningCrescent1: MoonWaningCrescent1,
  WiMoonWaningCrescent2: MoonWaningCrescent2,
  WiMoonWaningCrescent3: MoonWaningCrescent3,
  WiMoonWaningCrescent4: MoonWaningCrescent4,
  WiMoonWaningCrescent5: MoonWaningCrescent5,
  WiMoonWaningCrescent6: MoonWaningCrescent6,
};

export default function MoonPhaseIcon({ size = 25, className }: MoonPhaseIconProps) {
  const { timezone, isLoaded } = useTimezoneContext();
  const [iconName, setIconName] = useState<MoonPhaseIconName>('WiMoonNew');
  const [isCalculated, setIsCalculated] = useState(false);

  // Calculate moon phase on mount and when timezone changes
  useEffect(() => {
    const calculateIcon = () => {
      const newIconName = getMoonPhaseIconName();
      setIconName(newIconName);
      setIsCalculated(true);
    };

    calculateIcon();
  }, [timezone, isLoaded]);

  const IconComponent = moonPhaseComponents[iconName];
  const title = getMoonPhaseTitle(iconName);

  if (!IconComponent) {
    // Fallback to new moon if component not found
    return (
      <span title="new moon">
        <MoonNew size={size} className={className} key="fallback" />
      </span>
    );
  }

  return (
    <span title={title}>
      <IconComponent size={size} className={className} key={iconName} />
    </span>
  );
}
