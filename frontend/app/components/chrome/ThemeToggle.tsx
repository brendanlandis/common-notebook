"use client";
import { useTheme, type ThemeChoice } from "@/app/hooks/useTheme";
import {
  MoonStarsIcon,
  SunHorizonIcon,
  CircleHalfIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { TOOLTIP } from "@/app/components/ui/tooltip";
import { MENU_BUTTON, MENU_ICON } from "@/app/components/chrome/MenuItems";

// Icon shown for each choice. System uses CircleHalfIcon (a half-lit orb) so it
// sits in the same celestial family as the Sun/Moon icons and reads as "auto."
const ICONS: Record<ThemeChoice, Icon> = {
  light: SunHorizonIcon,
  dark: MoonStarsIcon,
  system: CircleHalfIcon,
};

export default function ThemeToggle() {
  const { choice, cycleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only render after hydration to avoid mismatch (choice depends on
  // localStorage + matchMedia, which don't exist on the server).
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder with the same footprint to avoid layout shift.
    return (
      <button id="themeToggle" className={MENU_BUTTON} />
    );
  }

  const CurrentIcon = ICONS[choice];

  return (
    <button
      onClick={cycleTheme}
      id="themeToggle"
      aria-label={`${choice} theme`}
      className={`${TOOLTIP} ${MENU_BUTTON}`}
      data-tip={`${choice} theme`}
    >
      <CurrentIcon size={MENU_ICON} weight="regular" />
    </button>
  );
}
