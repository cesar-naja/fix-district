import { customerTest as test, expect } from "./fixtures";
import { LIST_NAME, repairRow } from "./pages/repair-list";

// Seed for the Playwright planner/generator agents: the default `page` is
// already signed in as a disposable customer (a fresh Clerk test user), and one
// synthetic repair request exists in the emulator. Nothing here touches live
// services; the user and the request are removed when the test ends.
test.describe("Test group", () => {
  test("seed: signed-in customer with one request", async ({
    page,
    customer,
    seed,
    marker,
  }) => {
    await seed({ ownerId: customer.userId });
    await page.goto("/customer");
    await expect(repairRow(page, LIST_NAME.customer, marker)).toBeVisible();
  });
});
