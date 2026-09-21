'use client';
import { XIcon } from "@phosphor-icons/react";

export default function MenuClose() {
  const closeDrawer = () => {
    const drawerCheckbox = document.getElementById(
      'mainMenu'
    ) as HTMLInputElement;
    if (drawerCheckbox) drawerCheckbox.checked = false;
  };
  // Sits in the menu's <li>, so daisyUI's menu would give it a hover background.
  return (
    <button
      id="closeMenu"
      onClick={closeDrawer}
      className="hover:bg-transparent focus:bg-transparent active:bg-transparent"
    >
      <XIcon size={40} weight="regular" />
    </button>
  );
}
