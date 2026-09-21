'use client';
import { XIcon } from "@phosphor-icons/react";
import { CONTROL_ICON } from "@/app/components/chrome/iconSizes";
import { DrawerClose } from "@/app/components/ui/Drawer";

export default function MenuClose() {
  return (
    <DrawerClose id="closeMenu" aria-label="close menu" className="block">
      <XIcon size={CONTROL_ICON} weight="regular" />
    </DrawerClose>
  );
}
