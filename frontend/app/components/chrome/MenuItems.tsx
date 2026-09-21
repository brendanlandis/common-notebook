"use client";
import Link from "next/link";
import { GearIcon } from "@phosphor-icons/react/dist/ssr";
import MenuClose from "@/app/components/chrome/MenuClose";
import { DrawerClose } from "@/app/components/ui/Drawer";
import DrawerHeader from "@/app/components/ui/DrawerHeader";
import ThemeToggle from "@/app/components/chrome/ThemeToggle";
import { visiblePages } from "@/app/lib/pages";
import PageIcon from "@/app/components/chrome/PageIcon";
import { useBetaAccess } from "@/app/hooks/useBetaAccess";
import { TOOLTIP } from "@/app/components/ui/tooltip";

export default function MenuItems({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { betaAccess } = useBetaAccess();
  const pages = visiblePages(betaAccess);
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
      <MenuLink href="/" label="home" />
      {pages.includes("/practice") && (
        <MenuLink href="/practice" label="practice" />
      )}
      {pages.includes("/review/daily") && (
        <>
          <MenuLink href="/review/daily" label="today" />
          <MenuLink href="/review/periodic" label="review" />
        </>
      )}
    </>
  );
}

// Closes the drawer as it navigates.
function MenuLink({ href, label }: { href: string; label: string }) {
  // No background on hover, press or focus, which daisyUI's menu would add;
  // the underline is the whole affordance.
  return (
    <li>
      <DrawerClose asChild>
        <Link
          href={href}
          className="flex flex-nowrap items-center justify-start gap-3 py-3 pl-1 text-xl no-underline hover:bg-transparent hover:text-inherit hover:underline focus:bg-transparent focus:text-inherit focus:underline active:bg-transparent active:text-inherit active:underline"
        >
          <PageIcon path={href} size={30} weight="thin" />
          <span>{label}</span>
        </Link>
      </DrawerClose>
    </li>
  );
}
