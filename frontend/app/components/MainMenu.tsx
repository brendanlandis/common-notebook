"use client";

import { useState } from "react";
import Drawer from "./Drawer";
import HeaderIcon from "./HeaderIcon";
import MainMenuPanel from "./MainMenuPanel";

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
