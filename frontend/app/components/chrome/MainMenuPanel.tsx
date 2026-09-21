"use client";

import { useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import MenuItems from "@/app/components/chrome/MenuItems";
import DrawerHeader from "@/app/components/ui/DrawerHeader";
import { DRAWER_PANEL } from "@/app/components/ui/Drawer";
import SettingsPanel from "@/app/components/settings/SettingsPanel";

/**
 * The main menu drawer's content. A master/detail panel: the menu list, or a
 * pushed detail panel (settings) with a back arrow. The gear swaps this content
 * in place while the drawer stays open.
 *
 * The drawer unmounts this once it has finished closing, so the next open
 * starts back on the menu with nothing to reset.
 */
export default function MainMenuPanel() {
  const [panel, setPanel] = useState<"menu" | "settings">("menu");

  return panel === "menu" ? (
    <div className="min-h-full w-auto min-w-80 bg-base-300 p-4 text-base-content">
      <MenuItems onOpenSettings={() => setPanel("settings")} />
    </div>
  ) : (
    <div className={DRAWER_PANEL}>
      <DrawerHeader>
        <button
          type="button"
          onClick={() => setPanel("menu")}
          aria-label="back"
        >
          <ArrowLeftIcon size={40} weight="regular" />
        </button>
      </DrawerHeader>
      <SettingsPanel />
    </div>
  );
}
