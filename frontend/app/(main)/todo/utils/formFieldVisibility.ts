import type { TodoCategory } from "@/app/types/admin";

/**
 * Helper functions to determine form field visibility based on todo category
 * and other form state. Centralizes conditional logic that was previously
 * scattered throughout the TodoForm component.
 */

/**
 * Show tracking URL field only for "in the mail" category
 */
export function showTrackingUrl(category: TodoCategory | null): boolean {
  return category === "in the mail";
}

/**
 * Show purchase URL field for "buy stuff" OR "wishlist" categories
 */
export function showPurchaseUrl(category: TodoCategory | null): boolean {
  return category === "buy stuff" || category === "wishlist";
}

/**
 * Show price and wishlist category fields only for "wishlist" category
 */
export function showPriceAndWishlistCategory(
  category: TodoCategory | null
): boolean {
  return category === "wishlist";
}

/**
 * Show recurring checkbox for all categories except "in the mail", "buy stuff", and "wishlist"
 */
export function showRecurringCheckbox(category: TodoCategory | null): boolean {
  return (
    category !== "in the mail" &&
    category !== "buy stuff" &&
    category !== "wishlist"
  );
}

/**
 * Show soon checkbox for all categories except "in the mail" and "wishlist"
 * and only when the todo is not recurring
 */
export function showSoonCheckbox(
  category: TodoCategory | null,
  isRecurring: boolean
): boolean {
  return (
    category !== "in the mail" && category !== "wishlist" && !isRecurring
  );
}

/**
 * Show long checkbox for all categories except "in the mail", "buy stuff", and "wishlist"
 */
export function showLongCheckbox(category: TodoCategory | null): boolean {
  return (
    category !== "in the mail" &&
    category !== "buy stuff" &&
    category !== "errands" &&
    category !== "wishlist"
  );
}

/**
 * Show date fields (display date and due date) when:
 * - Not in "in the mail", "buy stuff", or "wishlist" categories
 * - AND not recurring
 */
export function showDateFields(
  category: TodoCategory | null,
  isRecurring: boolean
): boolean {
  return (
    category !== "in the mail" &&
    category !== "buy stuff" &&
    category !== "wishlist" &&
    !isRecurring
  );
}

/**
 * Determine if a category allows recurring todos
 * Returns false for "in the mail", "buy stuff", "wishlist", and "errands"
 */
export function allowsRecurring(category: TodoCategory | null): boolean {
  return (
    category !== "in the mail" &&
    category !== "buy stuff" &&
    category !== "wishlist" &&
    category !== "errands"
  );
}

