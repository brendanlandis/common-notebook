"use client";

import { useState } from "react";
import Drawer from "@/app/components/ui/Drawer";
import HeaderIcon from "@/app/components/chrome/HeaderIcon";
import MainMenuPanel from "@/app/components/chrome/MainMenuPanel";

/** The header's page icon, and the menu drawer it opens. */
export default function MainMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="open menu"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-success dim:text-primary"
      >
        <HeaderIcon />
      </button>
      <Drawer open={open} onOpenChange={setOpen} title="menu">
        <MainMenuPanel />
      </Drawer>
    </>
  );
}
