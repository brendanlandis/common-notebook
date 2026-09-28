"use client";

import { useEffect, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/app/lib/viewTransition";

/** The header's slides' timing: the site's one speed, and none when asked. */
const MOTION = "duration-(--transition-time) ease-[ease] motion-reduce:transition-none";

/**
 * Shows its children by sliding them out downward from under what's above
 * them, and back up to hide them. The box grows from nothing (a grid row going
 * from 0fr to 1fr, which animates to the content's own height) while the
 * content moves down with the box's bottom edge. It's mounted only while open
 * or closing, so a closed one costs nothing.
 */
export default function SlideDown({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [out, setOut] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames: the first lays it out shut, so the second has a closed
      // state to slide from.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setOut(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setOut(false);
    // No transition runs to end, so nothing would unmount it.
    if (prefersReducedMotion()) setMounted(false);
  }, [open]);

  if (!mounted) return null;
  return (
    <div
      className={`grid transition-[grid-template-rows] ${MOTION} ${out ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !open) setMounted(false);
      }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={`transition-[translate] ${MOTION} ${out ? "" : "-translate-y-full"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
