import { expect, test } from "../fixtures";
import { LIST_NAME, repairRow } from "../pages/repair-list";
import { RepairFormPage } from "../pages/repair-form.page";
import { repairInput } from "../support/data";

/**
 * Minimal checks that each disposable role works end to end: real Clerk
 * session, the role-specific page, the 403 for the other role's page, and the
 * emulator wiring in both directions. These are framework smoke tests, not the
 * repair-feature suite.
 */

test.describe("customer", () => {
  test("lands on the customer dashboard with an empty list", async ({ customerPage }) => {
    await customerPage.goto("/dashboard");
    await expect(customerPage).toHaveURL(/\/customer$/);
    await expect(customerPage.getByRole("heading", { name: "Welcome, E2E" })).toBeVisible();
    await expect(customerPage.getByText("No repairs yet")).toBeVisible();
  });

  test("gets access denied on the technician page", async ({ customerPage }) => {
    await customerPage.goto("/technician");
    await expect(customerPage.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });

  test("a submitted request is shown to its owner and stored in the emulator", async ({
    customerPage,
    customer,
    emulator,
    marker,
  }) => {
    const form = new RepairFormPage(customerPage);
    await form.goto();
    await form.fill(repairInput(marker));
    await form.submit();
    await expect(form.successNotice).toBeVisible();

    await customerPage.goto("/customer");
    await expect(repairRow(customerPage, LIST_NAME.customer, marker)).toBeVisible();

    // The write went to the emulator, owned by this test's disposable user.
    await expect
      .poll(async () => (await emulator.repairsOwnedBy(customer.userId)).length)
      .toBe(1);
  });
});

test.describe("technician", () => {
  test("lands on the technician dashboard and sees a seeded request", async ({
    technicianPage,
    seed,
    marker,
  }) => {
    await seed({ ownerId: `e2e-seed-owner-${marker}` });

    await technicianPage.goto("/dashboard");
    await expect(technicianPage).toHaveURL(/\/technician$/);
    await expect(technicianPage.getByRole("heading", { name: "Welcome, E2E" })).toBeVisible();
    await expect(repairRow(technicianPage, LIST_NAME.technician, marker)).toBeVisible();
  });

  test("gets access denied on the customer page", async ({ technicianPage }) => {
    await technicianPage.goto("/customer");
    await expect(technicianPage.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });
});
