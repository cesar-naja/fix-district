// spec: e2e/planner/plans/repair-workflow-approved-batch-1.md
// scenario: B1-04 (source: TECH-05, plus the detail checks from TECH-02)
// requirements: R9, R11, R12, R16
//
// The test creates its own prerequisites: a disposable customer who submits the
// request through the real form, and a disposable technician. No exploration-seed
// record is used. The technician queue is shared, so only this test's marker is asserted.

import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { LIST_NAME, repairRow } from "../../pages/repair-list";
import { RepairFormPage } from "../../pages/repair-form.page";
import { repairInput } from "../../support/data";

/** The <dd> of a labelled fact (<dt>label</dt><dd>value</dd>) on the request detail page. */
function fact(page: Page, label: string): Locator {
  return page
    .getByRole("main")
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
}

test.describe("Technician view of a customer request", () => {
  test("Submit as a customer, then verify a technician sees the same request and details", async ({
    customerPage,
    technicianPage,
    customer,
    emulator,
    marker,
  }) => {
    const data = repairInput(marker, { deviceType: "Console", brand: "Acme Console" });
    const form = new RepairFormPage(customerPage);
    const deviceName = `Acme Console Model ${marker}`;
    let repairId = "";

    // The same values, as shown on either role's detail page.
    async function expectDetailValues(page: Page): Promise<void> {
      await expect(fact(page, "Status")).toHaveText("Submitted");
      await expect(fact(page, "Device type")).toHaveText("Console");
      await expect(fact(page, "Brand")).toHaveText("Acme Console");
      await expect(fact(page, "Model")).toHaveText(`Model ${marker}`);
      await expect(page.getByRole("main").getByText(data.description, { exact: true })).toBeVisible();
    }

    await test.step("1. As the customer, submit the form once and capture the request id", async () => {
      await form.goto();
      await form.fill(data);
      await form.submit();

      await expect(form.successNotice).toBeVisible();
      await expect(form.viewRequestLink).toHaveAttribute("href", /^\/customer\/repairs\/[0-9a-f]{40}$/);
      const href = await form.viewRequestLink.getAttribute("href");
      repairId = href?.match(/^\/customer\/repairs\/([0-9a-f]{40})$/)?.[1] ?? "";
      expect(repairId).toMatch(/^[0-9a-f]{40}$/);
    });

    await test.step("2. Verify exactly one stored document owned by this customer", async () => {
      await expect
        .poll(async () => (await emulator.repairsOwnedBy(customer.userId)).length, {
          message: "exactly one repair request is stored for this customer",
        })
        .toBe(1);

      const [stored] = await emulator.repairsOwnedBy(customer.userId);
      expect(stored.id).toBe(repairId);
      expect(stored.deviceType).toBe("console");
      expect(stored.brand).toBe("Acme Console");
      expect(stored.model).toBe(`Model ${marker}`);
      expect(stored.status).toBe("submitted");
    });

    await test.step("3. As the technician, the queue shows this request", async () => {
      await technicianPage.goto("/technician");
      const row = repairRow(technicianPage, LIST_NAME.technician, marker);
      // The marker row is the positive signal that the queue has loaded.
      await expect(row).toBeVisible();
      await expect(row).toHaveCount(1);
      await expect(row.getByRole("link", { name: deviceName })).toBeVisible();
      await expect(row).toContainText("Console");
      await expect(row.getByText("Submitted", { exact: true })).toBeVisible();
      await expect(row.getByRole("link")).toHaveAttribute("href", `/technician/repairs/${repairId}`);
    });

    await test.step("4. Open the row and verify the technician detail view", async () => {
      await repairRow(technicianPage, LIST_NAME.technician, marker).getByRole("link").click();
      await expect(technicianPage).toHaveURL(new RegExp(`/technician/repairs/${repairId}$`));

      await expectDetailValues(technicianPage);
      await expect(technicianPage.getByRole("heading", { name: "Page not found" })).toHaveCount(0);

      const main = technicianPage.getByRole("main");
      await expect(
        main.getByText("Read-only for now. Status changes, estimates, and assignment are not available yet."),
      ).toBeVisible();
      await expect(main.getByRole("link", { name: "Back to repair queue" })).toBeVisible();

      // Read-only: no form controls in the main region.
      await expect(main.locator("form, input, textarea, select, button")).toHaveCount(0);

      // No owner identifiers are exposed.
      await expect(main).not.toContainText(customer.userId);
      await expect(main).not.toContainText(customer.email);
    });

    await test.step("5. As the customer, the detail page shows the same values", async () => {
      await customerPage.goto(`/customer/repairs/${repairId}`);
      await expectDetailValues(customerPage);
    });
  });
});
