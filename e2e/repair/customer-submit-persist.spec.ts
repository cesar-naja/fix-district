// spec: e2e/specs/repair-workflow-approved-batch-1.md
// scenario: B1-01 (source: CUS-01 steps 3 to 5, plus the reload step from CUS-05;
//   see e2e/specs/repair-workflow-planner.md)
// requirements: R4, R7, R9, R11
// seed (exploration only, not a dependency): e2e/seed.customer.spec.ts
//
// The test creates its own prerequisites: the disposable `customer` fixture and
// no records. It does not use any record created by the seed.

import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { RepairFormPage } from "../pages/repair-form.page";
import { repairInput } from "../support/data";

/** The <dd> of a labelled fact (<dt>label</dt><dd>value</dd>) on the request detail page. */
function fact(page: Page, label: string): Locator {
  return page
    .getByRole("main")
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
}

test.describe("Customer repair submission and persistence", () => {
  test("Submit a valid repair, open its details, reload, verify the saved values persist", async ({
    customerPage: page,
    customer,
    emulator,
    marker,
  }) => {
    const data = repairInput(marker, { deviceType: "Tablet", brand: "Acme Tab" });
    const form = new RepairFormPage(page);
    let repairId = "";

    // The same five values, checked after opening the details and again after a reload.
    async function expectSavedValues(): Promise<void> {
      await expect(page).toHaveURL(new RegExp(`/customer/repairs/${repairId}$`));
      await expect(fact(page, "Status")).toHaveText("Submitted");
      await expect(fact(page, "Device type")).toHaveText("Tablet");
      await expect(fact(page, "Brand")).toHaveText("Acme Tab");
      await expect(fact(page, "Model")).toHaveText(`Model ${marker}`);
      // The description is its own paragraph under the "Problem description" heading.
      await expect(page.getByRole("main").getByText(data.description, { exact: true })).toBeVisible();
      // A submitted date is shown. Its value is server-assigned, so only its form is checked.
      await expect(fact(page, "Submitted")).toHaveText(/UTC$/);
    }

    await test.step("1. Read the baseline: this customer owns no repair requests", async () => {
      const before = await emulator.repairsOwnedBy(customer.userId);
      expect(before).toHaveLength(0);
    });

    await test.step("2. Submit the form once and capture the new request id", async () => {
      await form.goto();
      await form.fill(data);
      await form.submit();

      await expect(form.successNotice).toBeVisible();
      await expect(form.viewRequestLink).toHaveAttribute("href", /^\/customer\/repairs\/[0-9a-f]{40}$/);
      const href = await form.viewRequestLink.getAttribute("href");
      repairId = href?.match(/^\/customer\/repairs\/([0-9a-f]{40})$/)?.[1] ?? "";
      expect(repairId).toMatch(/^[0-9a-f]{40}$/);
    });

    await test.step("3. Open the request details and verify the shown values", async () => {
      await form.viewRequestLink.click();
      await expectSavedValues();
    });

    await test.step("4. Reload and verify the same values are shown again", async () => {
      await page.reload();
      await expectSavedValues();
    });

    await test.step("5. Verify exactly one stored document with the submitted values", async () => {
      await expect
        .poll(async () => (await emulator.repairsOwnedBy(customer.userId)).length, {
          message: "exactly one repair request is stored for this customer",
        })
        .toBe(1);

      const [stored] = await emulator.repairsOwnedBy(customer.userId);
      expect(stored.id).toBe(repairId);
      expect(stored.deviceType).toBe("tablet");
      expect(stored.brand).toBe("Acme Tab");
      expect(stored.model).toBe(`Model ${marker}`);
      expect(stored.description).toBe(`Synthetic problem description for automated testing ${marker}.`);
      expect(stored.status).toBe("submitted");
      // Server-assigned: only present and valid, not compared against a time window.
      expect(stored.createdAt).not.toBeNull();
      expect(Number.isNaN(Date.parse(stored.createdAt ?? ""))).toBe(false);
    });
  });
});
