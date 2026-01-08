"use client";
import { useTheme } from "../hooks/useTheme";
import { MoonStarsIcon, SunHorizonIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only render after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same size to avoid layout shift
    return (
      <button id="themeToggle">
        <div style={{ width: 40, height: 40 }} />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      id="themeToggle"
      aria-label="toggle theme"
      className="tooltip"
      data-tip="toggle theme"
    >
      {theme === "light" ? (
        <SunHorizonIcon size={30} weight="regular" />
      ) : (
        <MoonStarsIcon size={30} weight="regular" />
      )}
    </button>
  );
}
