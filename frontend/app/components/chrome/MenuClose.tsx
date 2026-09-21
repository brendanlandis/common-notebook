'use client';
import { XIcon } from "@phosphor-icons/react";
import { DrawerClose } from "@/app/components/ui/Drawer";

export default function MenuClose() {
  // Sits in the menu's <li>, so daisyUI's menu would give it a hover background.
  return (
    <DrawerClose
      id="closeMenu"
      aria-label="close menu"
      className="hover:bg-transparent focus:bg-transparent active:bg-transparent"
    >
      <XIcon size={40} weight="regular" />
    </DrawerClose>
  );
}
