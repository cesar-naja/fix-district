import type { Locator, Page } from "@playwright/test";

/** Accessible names of the two lists, which share one component in the app. */
export const LIST_NAME = {
  customer: "My repair requests, newest first",
  technician: "Repair queue, newest first",
} as const;

/**
 * The list item that contains `marker`, inside the named list. Tests find their
 * own record by its unique marker, never by position or count, because other
 * parallel tests may add records to the same list.
 */
export function repairRow(page: Page, listName: string, marker: string): Locator {
  return page
    .getByRole("list", { name: listName })
    .getByRole("listitem")
    .filter({ hasText: marker });
}
