"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

/**
 * A panel that slides in from the left over a dimmed page: the main menu and the
 * task actions drawer. Radix Dialog does the behavior — Escape and the overlay
 * close it, Tab stays inside, the page behind doesn't scroll — and ships no
 * styles, so the look is ours.
 *
 * Focus goes back to whatever had it when the drawer opened. Radix only does
 * that for its own `Dialog.Trigger`, and the task drawer is opened from several
 * header buttons, so the drawer remembers for itself.
 *
 * `onExited` runs once the close animation has finished and the panel is gone,
 * for callers that clear what the panel showed. Clearing any sooner would change
 * the panel's contents while it's still sliding out.
 */
export default function Drawer({
  open,
  onOpenChange,
  title,
  onExited,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Read by screen readers only. */
  title: string;
  onExited?: () => void;
  children: ReactNode;
}) {
  const returnFocusTo = useRef<HTMLElement | null>(null);

  // Layout effects run before Radix's focus scope moves focus into the panel,
  // so this still sees the button that opened it.
  useLayoutEffect(() => {
    if (open) returnFocusTo.current = document.activeElement as HTMLElement | null;
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo.current?.focus();
          }}
          className="fixed inset-y-0 left-0 z-40 max-w-full overflow-y-auto overscroll-contain text-base-content data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
          <ExitSignal open={open} onExited={onExited} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Calls `onExited` when the panel unmounts, which Radix does only after the
 * close animation. The `open` check skips React's development-mode double
 * mount, whose simulated unmount happens while the drawer is open.
 */
function ExitSignal({
  open,
  onExited,
}: {
  open: boolean;
  onExited?: () => void;
}) {
  const latest = useRef({ open, onExited });
  useEffect(() => {
    latest.current = { open, onExited };
  });
  useEffect(
    () => () => {
      if (!latest.current.open) latest.current.onExited?.();
    },
    []
  );
  return null;
}

/**
 * The panel of a drawer that holds a form or a list to work through: settings,
 * add and manage. One width and one background for all of them; full width on
 * a phone. The main menu is its own, narrower kind.
 */
export const DRAWER_PANEL =
  "min-h-full w-screen bg-base-300 p-4 text-base-content min-[500px]:w-[500px]";

/** Closes the drawer it sits in. */
export const DrawerClose = Dialog.Close;
