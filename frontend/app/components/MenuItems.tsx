"use client";
import Link from "next/link";
import { GearIcon } from "@phosphor-icons/react/dist/ssr";
import MenuClose from "./MenuClose";
import DrawerHeader from "./DrawerHeader";
import ThemeToggle from "./ThemeToggle";
import { visiblePages } from "@/app/lib/pages";
import PageIcon from "./PageIcon";
import { useBetaAccess } from "@/app/hooks/useBetaAccess";
import { TOOLTIP } from "@/app/components/tooltip";

export default function MenuItems({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { betaAccess } = useBetaAccess();
  const pages = visiblePages(betaAccess);
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
      <MenuLink href="/" label="home" onClick={closeDrawer} />
      {pages.includes("/practice") && (
        <MenuLink href="/practice" label="practice" onClick={closeDrawer} />
      )}
      {pages.includes("/review/daily") && (
        <>
          <MenuLink href="/review/daily" label="today" onClick={closeDrawer} />
          <MenuLink href="/review/periodic" label="review" onClick={closeDrawer} />
        </>
      )}
    </>
  );
}

function MenuLink({
  href,
  label,
  onClick,
}: {
  href: string;
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
        <PageIcon path={href} size={30} weight="thin" />
        <span>{label}</span>
      </Link>
    </li>
  );
}
