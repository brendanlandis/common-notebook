/**
 * Icon sizes for the app's chrome.
 *
 * A few icons don't *look* their size, so they have their own sizes, set by eye
 * until all read as the same height: the moon and caret here, and the page
 * icons in PageIcon.tsx.
 */

/** Every drawer's close or back button. */
export const CONTROL_ICON = 32;

/**
 * The main menu's secondary buttons: a square the size of the close button,
 * around a smaller icon, so they center on the close button and the rightmost
 * icon's right margin equals its top margin.
 */
export const MENU_BUTTON = "flex size-8 items-center justify-center";
export const MENU_ICON = 22;

/** The header's buttons right of the view selector: the main menu's theme and settings size. */
export const HEADER_ICON = MENU_ICON;

/**
 * The moon is a filled disc, which reads larger than an outline. It and the
 * caret keep the proportions they were given by eye beside 32px icons (26 and 17).
 */
export const MOON_ICON = 18;

/** The header's "more buttons" caret: smaller than the rest on purpose, still centered. */
export const CARET_ICON = 12;
