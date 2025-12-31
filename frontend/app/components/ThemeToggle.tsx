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
      <button id="themeToggle" title="toggle theme" style={{ width: 40, height: 40 }}>
        <div style={{ width: 40, height: 40 }} />
      </button>
    );
  }

  return (
    <button onClick={toggleTheme} id="themeToggle" title="toggle theme">
      {theme === "light" ? (
        <SunHorizonIcon size={40} weight="regular" />
      ) : (
        <MoonStarsIcon size={40} weight="regular" />
      )}
    </button>
  );
}
