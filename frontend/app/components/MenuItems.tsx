"use client";
import Link from "next/link";
import {
  BirdIcon,
  BroomIcon,
  MetronomeIcon,
  GearIcon,
} from "@phosphor-icons/react/dist/ssr";
import MenuClose from "./MenuClose";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";
import { soleDestination, visiblePages } from "@/app/lib/pages";
import { useBetaAccess } from "@/app/contexts/BetaAccessContext";

export default function MenuItems() {
  const { betaAccess } = useBetaAccess();
  const pages = visiblePages(betaAccess);
  // Home redirects to the sole destination, so a link to it would be a dead entry.
  const showHome = soleDestination(betaAccess) === null;
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
      {showHome && (
        <li>
          <Link href="/" onClick={closeDrawer}>
            <BirdIcon size={30} weight="thin" />
            <span>home</span>
          </Link>
        </li>
      )}
      <li>
        <Link href="/todo" onClick={closeDrawer}>
          <BroomIcon size={30} weight="thin" />
          <span>to do</span>
        </Link>
      </li>
      {pages.includes("/practice") && (
        <li>
          <Link href="/practice" onClick={closeDrawer}>
            <MetronomeIcon size={30} weight="thin" />
            <span>practice</span>
          </Link>
        </li>
      )}
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
