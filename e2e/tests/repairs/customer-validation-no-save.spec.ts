// spec: e2e/planner/plans/repair-workflow-approved-batch-1.md
// scenario: B1-02 (source: CUS-02; see e2e/planner/plans/repair-workflow-planner.md)
// requirements: R5, R6
// seed (exploration only, not a dependency): e2e/planner/seeds/seed.customer.spec.ts
//
// The test creates its own prerequisites: the disposable `customer` fixture and
// one request seeded for that customer. It does not use any record created by the seed.

import { test, expect } from "../../fixtures";
import { RepairFormPage } from "../../pages/repair-form.page";
import { LIST_NAME, repairRow } from "../../pages/repair-list";

test.describe("Customer repair form validation", { tag: "@repair" }, () => {
  test("Submit an empty form, verify validation errors, and verify no record was saved", async ({
    customerPage: page,
    customer,
    emulator,
    seed,
    marker,
  }) => {
    const form = new RepairFormPage(page);
    let before: Awaited<ReturnType<typeof emulator.repairsOwnedBy>> = [];
    let seededId = "";

    await test.step("1. Seed one request for this customer and read the baseline", async () => {
      seededId = await seed({ ownerId: customer.userId });
      before = await emulator.repairsOwnedBy(customer.userId);
      expect(before).toHaveLength(1);
      expect(before[0].id).toBe(seededId);
    });

    await test.step("2. Submit the empty form and verify the validation messages", async () => {
      await form.goto();
      await form.submit();

      await expect(page).toHaveURL(/\/customer\/new$/);

      // The problem summary is the parent of its title paragraph.
      const summary = page.locator("#repair-form-problem").locator("xpath=..");
      await expect(page.locator("#repair-form-problem")).toHaveText("Please fix the following before sending:");
      await expect(summary.getByRole("link")).toHaveText([
        "Device type: Choose the type of device.",
        "Brand: Enter the brand.",
        "Model: Enter the model.",
        "What’s wrong?: Describe the problem.",
      ]);

      // Inline errors, tied to their fields through aria-describedby.
      await expect(page.getByRole("group", { name: /device type/i })).toHaveAccessibleDescription(
        /Choose the type of device\./,
      );
      await expect(form.brand).toHaveAccessibleDescription(/Enter the brand\./);
      await expect(form.model).toHaveAccessibleDescription(/Enter the model\./);
      await expect(form.description).toHaveAccessibleDescription(/Describe the problem\./);

      await expect(form.brand).toHaveAttribute("aria-invalid", "true");
      await expect(form.model).toHaveAttribute("aria-invalid", "true");
      await expect(form.description).toHaveAttribute("aria-invalid", "true");

      await expect(form.successNotice).toBeHidden();
      await expect(form.viewRequestLink).toHaveCount(0);
    });

    await test.step("3. Verify this customer's stored requests are unchanged", async () => {
      const after = await emulator.repairsOwnedBy(customer.userId);
      expect(after).toEqual(before);
    });

    await test.step("4. Navigate to the list and verify the stored requests are still unchanged", async () => {
      await page.goto("/customer");
      // Positive signal that the list finished loading.
      await expect(repairRow(page, LIST_NAME.customer, marker)).toBeVisible();

      const afterNavigation = await emulator.repairsOwnedBy(customer.userId);
      expect(afterNavigation).toEqual(before);
    });
  });
});
