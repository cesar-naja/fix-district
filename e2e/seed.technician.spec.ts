import { technicianTest as test, expect } from "./fixtures";
import { LIST_NAME, repairRow } from "./pages/repair-list";

// Seed for the Playwright planner/generator agents: the default `page` is
// already signed in as a disposable technician (a fresh Clerk test user with
// the technician role), and one synthetic repair request exists in the
// emulator. The technician queue is shared by every user, so tests find their
// own record by its marker and never rely on counts or order.
test.describe("Test group", () => {
  test("seed: signed-in technician with one queued request", async ({
    page,
    seed,
    marker,
  }) => {
    await seed({ ownerId: `e2e-seed-owner-${marker}` });
    await page.goto("/technician");
    await expect(repairRow(page, LIST_NAME.technician, marker)).toBeVisible();
  });
});
