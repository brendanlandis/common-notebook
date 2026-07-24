"use client";

import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import MenuItems from "./MenuItems";
import SettingsPanel from "./SettingsPanel";

/**
 * The drawer-side content of the main menu. A master/detail panel: the menu
 * list, or a pushed detail panel (settings) with a back arrow. The gear no
 * longer navigates to /settings — it swaps this content in place while the
 * drawer stays open.
 *
 * The drawer's own open/close is still 100% CSS via the `#mainMenu` checkbox;
 * we only listen for it closing so the next open starts back on the menu.
 */
export default function MainMenuPanel() {
  const [panel, setPanel] = useState<"menu" | "settings">("menu");

  // Reset to the menu whenever the drawer closes. Every dismiss path (X button,
  // overlay label, header toggle, Escape) ends by unchecking this one checkbox,
  // so a single listener covers them all. The swap is hidden behind the
  // drawer's slide-out, so no delay is needed.
  useEffect(() => {
    const checkbox = document.getElementById(
      "mainMenu"
    ) as HTMLInputElement | null;
    if (!checkbox) return;
    const onChange = () => {
      if (!checkbox.checked) setPanel("menu");
    };
    checkbox.addEventListener("change", onChange);
    return () => checkbox.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="drawer-side">
      <label
        htmlFor="mainMenu"
        aria-label="close sidebar"
        className="drawer-overlay"
      ></label>
      {panel === "menu" ? (
        <ul className="menu bg-base-200 text-base-content min-h-full w-auto p-4">
          <MenuItems onOpenSettings={() => setPanel("settings")} />
        </ul>
      ) : (
        <div className="bg-base-200 text-base-content min-h-full w-80 max-w-[90vw] p-4">
          <div className="main-menu-header">
            <button
              type="button"
              onClick={() => setPanel("menu")}
              aria-label="back"
            >
              <ArrowLeftIcon size={40} weight="regular" />
            </button>
          </div>
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}
