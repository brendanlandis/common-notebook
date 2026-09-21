"use client";
import Link from "next/link";
import { GearIcon } from "@phosphor-icons/react/dist/ssr";
import MenuClose from "@/app/components/chrome/MenuClose";
import { DrawerClose } from "@/app/components/ui/Drawer";
import ThemeToggle from "@/app/components/chrome/ThemeToggle";
import { visiblePages } from "@/app/lib/pages";
import PageIcon from "@/app/components/chrome/PageIcon";
import { useBetaAccess } from "@/app/hooks/useBetaAccess";
import { TOOLTIP } from "@/app/components/ui/tooltip";

/** The menu row's secondary buttons: a 40px square, like the close button, around a smaller icon. */
export const MENU_BUTTON = "flex size-10 items-center justify-center";
export const MENU_ICON = 28;

export default function MenuItems({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { betaAccess } = useBetaAccess();
  const pages = visiblePages(betaAccess);
  return (
    <>
      {/* The close button lands exactly on the header's open button (both at the
          drawer's and the header's 1rem padding, both 40px), so the menu opens
          and closes from one spot. The other buttons are 40px squares too, with
          smaller icons centered in them: centered on the close button, and the
          rightmost icon's right margin equals its top margin. */}
      <div className="mb-4 flex items-center justify-between">
        <MenuClose />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className={`${TOOLTIP} ${MENU_BUTTON}`}
            data-tip="settings"
            aria-label="settings"
          >
            <GearIcon size={MENU_ICON} weight="regular" />
          </button>
          <ThemeToggle />
        </div>
      </div>
      <ul className="menu w-full p-0">
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
      </ul>
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
