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
      // The rightmost button in the menu drawer, whose edge would clip a centered
      // bubble. --tt-trans is daisyUI's tooltip X-translate (default -50%); this
      // lines the bubble's right edge up with the icon's. daisyUI shares it with
      // the tail, so the after: transform puts the tail back under the icon.
      className={`${TOOLTIP} ${MENU_BUTTON} [--tt-trans:calc(-100%_+_1.25rem)] after:[transform:translateX(-50%)_translateY(var(--tt-pos,-0.25rem))_rotate(180deg)]`}
      data-tip={`${choice} theme`}
    >
      <CurrentIcon size={MENU_ICON} weight="regular" />
    </button>
  );
}
