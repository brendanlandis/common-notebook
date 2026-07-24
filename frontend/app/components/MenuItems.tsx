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
import { useBetaAccess } from "@/app/hooks/useBetaAccess";

export default function MenuItems({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
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
        <div className="menu-actions">
          <LogoutButton />
          <button
            id="settings-link"
            type="button"
            onClick={onOpenSettings}
            className="tooltip tooltip-bottom"
            data-tip="settings"
            aria-label="settings"
          >
            <GearIcon size={25} weight="regular" />
          </button>
          <ThemeToggle />
        </div>
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
    </>
  );
}
