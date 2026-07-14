import type { ProjectType } from "@/app/types/index";

/**
 * Helper functions to determine form field visibility based on the selected
 * project's `projectType` and other form state. Centralizes conditional logic
 * that was previously scattered throughout the TaskForm component. The four
 * "stuff" project types (in the mail / buy stuff / wishlist / errands) drive the
 * shopping-list fields; everything else behaves like an ordinary task.
 */

/**
 * Show tracking URL field only for "in the mail" project type
 */
export function showTrackingUrl(projectType: ProjectType | null): boolean {
  return projectType === "in the mail";
}

/**
 * Show purchase URL field for "buy stuff" OR "wishlist" project types
 */
export function showPurchaseUrl(projectType: ProjectType | null): boolean {
  return projectType === "buy stuff" || projectType === "wishlist";
}

/**
 * Show price and wishlist category fields only for "wishlist" project type
 */
export function showPriceAndWishlistCategory(
  projectType: ProjectType | null
): boolean {
  return projectType === "wishlist";
}

/**
 * Show recurring checkbox for all project types except "in the mail", "buy stuff", and "wishlist"
 */
export function showRecurringCheckbox(projectType: ProjectType | null): boolean {
  return (
    projectType !== "in the mail" &&
    projectType !== "buy stuff" &&
    projectType !== "wishlist"
  );
}

/**
 * Show soon checkbox for all project types except "in the mail" and "wishlist"
 * and only when the task is not recurring
 */
export function showSoonCheckbox(
  projectType: ProjectType | null,
  isRecurring: boolean
): boolean {
  return (
    projectType !== "in the mail" && projectType !== "wishlist" && !isRecurring
  );
}

/**
 * Show long checkbox for all project types except "in the mail", "buy stuff", "errands", and "wishlist"
 */
export function showLongCheckbox(projectType: ProjectType | null): boolean {
  return (
    projectType !== "in the mail" &&
    projectType !== "buy stuff" &&
    projectType !== "errands" &&
    projectType !== "wishlist"
  );
}

/**
 * Show date fields (display date and due date) when:
 * - Not in "in the mail", "buy stuff", or "wishlist" project types
 * - AND not recurring
 */
export function showDateFields(
  projectType: ProjectType | null,
  isRecurring: boolean
): boolean {
  return (
    projectType !== "in the mail" &&
    projectType !== "buy stuff" &&
    projectType !== "wishlist" &&
    !isRecurring
  );
}

/**
 * Determine if a project type allows recurring tasks
 * Returns false for "in the mail", "buy stuff", "wishlist", and "errands"
 */
export function allowsRecurring(projectType: ProjectType | null): boolean {
  return (
    projectType !== "in the mail" &&
    projectType !== "buy stuff" &&
    projectType !== "wishlist" &&
    projectType !== "errands"
  );
}
