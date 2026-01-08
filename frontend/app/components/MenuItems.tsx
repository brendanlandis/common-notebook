"use client";
import Link from "next/link";
import {
  BirdIcon,
  BroomIcon,
  MetronomeIcon,
  PencilIcon,
  GearIcon,
} from "@phosphor-icons/react/dist/ssr";
import MenuClose from "./MenuClose";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";

export default function MenuItems() {
  const closeDrawer = () => {
    const drawerCheckbox = document.getElementById(
      "mainMenu"
    ) as HTMLInputElement;
    if (drawerCheckbox) drawerCheckbox.checked = false;
  };
  return (
    <>
      <li className="main-menu-header">
        <MenuClose />
      </li>
      <li>
        <Link href="/" onClick={closeDrawer}>
          <BirdIcon size={30} weight="thin" />
          <span>home</span>
        </Link>
      </li>
      <li>
        <Link href="/todo" onClick={closeDrawer}>
          <BroomIcon size={30} weight="thin" />
          <span>to do</span>
        </Link>
      </li>
      <li>
        <Link href="/practice" onClick={closeDrawer}>
          <MetronomeIcon size={30} weight="thin" />
          <span>practice</span>
        </Link>
      </li>
      <li>
        <Link href="/notes" onClick={closeDrawer}>
          <PencilIcon size={30} weight="thin" />
          <span>notes</span>
        </Link>
      </li>
      <li>
        <ThemeToggle />
        <Link
          id="settings-link"
          href="/settings"
          onClick={closeDrawer}
          className="tooltip"
          data-tip="settings"
          aria-label="settings"
        >
          <GearIcon size={30} weight="regular" />
        </Link>
        <LogoutButton />
      </li>
    </>
  );
}
