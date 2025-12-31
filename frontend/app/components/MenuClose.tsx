'use client';
import { XIcon } from "@phosphor-icons/react";

export default function MenuClose() {
  const closeDrawer = () => {
    const drawerCheckbox = document.getElementById(
      'adminMenu'
    ) as HTMLInputElement;
    if (drawerCheckbox) drawerCheckbox.checked = false;
  };
  return (
    <button id="closeMenu" onClick={closeDrawer}>
      <XIcon size={40} weight="regular" />
    </button>
  );
}
