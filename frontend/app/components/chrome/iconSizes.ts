/**
 * Icon sizes for the app's chrome, set by the header's view selector: a small
 * daisyUI select (`select-sm`) is 2rem tall, and header icons, and every
 * drawer's close or back button, match it.
 *
 * A few icons don't *look* 32px at 32px, so they have their own sizes, set by
 * eye on 2026-09-21 until all read as the same height: the moon and caret here,
 * and the page icons in PageIcon.tsx.
 */
export const CONTROL_ICON = 32;

/** The moon is a filled disc, which reads larger than an outline. */
export const MOON_ICON = 26;

/** The header's "more buttons" caret: smaller than the rest on purpose, still centered. */
export const CARET_ICON = 17;

/**
 * The main menu's secondary buttons: a square the size of the close button,
 * around a smaller icon, so they center on the close button and the rightmost
 * icon's right margin equals its top margin.
 */
export const MENU_BUTTON = "flex size-8 items-center justify-center";
export const MENU_ICON = 22;
