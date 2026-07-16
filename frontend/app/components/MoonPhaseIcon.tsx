'use client';

import { useState, useEffect } from 'react';
import { getMoonPhaseIconName, type MoonPhaseIconName } from '../lib/moonPhase';
import { useDateTimeSettings } from '../contexts/DateTimeSettingsContext';
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
  const { timeZoneSettings } = useDateTimeSettings();
  const [iconName, setIconName] = useState<MoonPhaseIconName>('WiMoonNew');
  const [isCalculated, setIsCalculated] = useState(false);

  // Calculate moon phase on mount and when the time settings change
  useEffect(() => {
    const calculateIcon = () => {
      const newIconName = getMoonPhaseIconName(timeZoneSettings);
      setIconName(newIconName);
      setIsCalculated(true);
    };

    calculateIcon();
  }, [timeZoneSettings]);

  const IconComponent = moonPhaseComponents[iconName];

  if (!IconComponent) {
    // Fallback to new moon if component not found
    return (
      <span title="new moon">
        <MoonNew size={size} className={className} key="fallback" />
      </span>
    );
  }

  return (
    <span>
      <IconComponent size={size} className={className} key={iconName} />
    </span>
  );
}
