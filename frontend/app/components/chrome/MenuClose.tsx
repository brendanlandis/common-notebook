'use client';
import { XIcon } from "@phosphor-icons/react";
import { DrawerClose } from "@/app/components/ui/Drawer";

export default function MenuClose() {
  return (
    <DrawerClose id="closeMenu" aria-label="close menu" className="block">
      <XIcon size={40} weight="regular" />
    </DrawerClose>
  );
}
