"use client";

import { useEffect } from "react";
import { fitTooltip } from "@/app/components/ui/tooltip";

/**
 * Keeps every tooltip's bubble on screen, by moving it into view just before it
 * shows: on hover, or when something inside it takes keyboard focus. Mounted
 * once, in the root layout, so a tooltip needs nothing but its `data-tip`.
 */
export default function TooltipsInView() {
  useEffect(() => {
    const fit = (event: Event) => {
      const tip =
        event.target instanceof Element ? event.target.closest(".tooltip[data-tip]") : null;
      if (tip instanceof HTMLElement) fitTooltip(tip);
    };
    document.addEventListener("pointerover", fit);
    document.addEventListener("focusin", fit);
    return () => {
      document.removeEventListener("pointerover", fit);
      document.removeEventListener("focusin", fit);
    };
  }, []);

  return null;
}
