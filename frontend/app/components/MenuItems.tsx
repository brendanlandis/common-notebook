"use client";
import Link from "next/link";
import {
  BirdIcon,
  BroomIcon,
  MetronomeIcon,
  GearIcon,
  SunIcon,
  CompassIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import MenuClose from "./MenuClose";
import DrawerHeader from "./DrawerHeader";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";
import { soleDestination, visiblePages } from "@/app/lib/pages";
import { useBetaAccess } from "@/app/hooks/useBetaAccess";
import { TOOLTIP } from "@/app/components/tooltip";

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
      <DrawerHeader as="li">
        <div className="flex flex-nowrap items-center gap-4 p-0 hover:cursor-default hover:bg-transparent">
          <LogoutButton />
          <button
            type="button"
            onClick={onOpenSettings}
            className={TOOLTIP}
            data-tip="settings"
            aria-label="settings"
          >
            <GearIcon size={25} weight="regular" />
          </button>
          <ThemeToggle />
        </div>
        <MenuClose />
      </DrawerHeader>
      {showHome && (
        <MenuLink href="/" icon={BirdIcon} label="home" onClick={closeDrawer} />
      )}
      <MenuLink href="/todo" icon={BroomIcon} label="to do" onClick={closeDrawer} />
      {pages.includes("/practice") && (
        <MenuLink
          href="/practice"
          icon={MetronomeIcon}
          label="practice"
          onClick={closeDrawer}
        />
      )}
      {pages.includes("/review/daily") && (
        <>
          <MenuLink
            href="/review/daily"
            icon={SunIcon}
            label="today"
            onClick={closeDrawer}
          />
          <MenuLink
            href="/review/periodic"
            icon={CompassIcon}
            label="review"
            onClick={closeDrawer}
          />
        </>
      )}
    </>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: Icon;
  label: string;
  onClick: () => void;
}) {
  // No background on hover, press or focus, which daisyUI's menu would add;
  // the underline is the whole affordance.
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex flex-nowrap items-center justify-start gap-3 py-3 pl-1 text-xl no-underline hover:bg-transparent hover:text-inherit hover:underline focus:bg-transparent focus:text-inherit focus:underline active:bg-transparent active:text-inherit active:underline"
      >
        <Icon size={30} weight="thin" />
        <span>{label}</span>
      </Link>
    </li>
  );
}
