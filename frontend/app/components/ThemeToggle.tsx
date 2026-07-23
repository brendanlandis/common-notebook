"use client";
import { useTheme, type ThemeChoice } from "../hooks/useTheme";
import {
  MoonStarsIcon,
  SunHorizonIcon,
  CircleHalfIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

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
      <button id="themeToggle">
        <div style={{ width: 40, height: 40 }} />
      </button>
    );
  }

  const CurrentIcon = ICONS[choice];

  return (
    <button
      onClick={cycleTheme}
      id="themeToggle"
      aria-label={`${choice} theme`}
      className="tooltip"
      data-tip={`${choice} theme`}
    >
      <CurrentIcon size={25} weight="regular" />
    </button>
  );
}
