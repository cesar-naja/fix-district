// spec: e2e/planner/plans/repair-workflow-approved-batch-1.md
// scenario: B1-03 (source: ISO-01 direct URL, plus the list part of ISO-02)
// requirements: R10, R11
//
// The test creates its own prerequisites: two disposable customers and one
// request each, written through the `seed` fixture. No exploration-seed record is used.

import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { LIST_NAME, repairRow } from "../../pages/repair-list";
import { repairInput } from "../../support/data";

const MISSING_ID = "0123456789abcdef0123456789abcdef01234567";

/** The <dd> of a labelled fact (<dt>label</dt><dd>value</dd>) on the request detail page. */
function fact(page: Page, label: string): Locator {
  return page
    .getByRole("main")
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
}

test.describe("Customer request isolation", { tag: "@repair" }, () => {
  test("Customer B cannot list or open Customer A's request, while A can still open it", async ({
    customerPage: pageA,
    otherCustomerPage: pageB,
    customer,
    otherCustomer,
    emulator,
    seed,
    marker,
  }) => {
    const tokenA = `${marker}-A`;
    const tokenB = `${marker}-B`;
    const dataA = repairInput(tokenA, {
      deviceType: "Phone",
      brand: "Brand A",
      description: `Synthetic problem description for automated testing ${tokenA}.`,
    });
    const dataB = repairInput(tokenB, {
      deviceType: "Laptop",
      brand: "Brand B",
      description: `Synthetic problem description for automated testing ${tokenB}.`,
    });
    let idA = "";
    let idB = "";
    let docsA: Awaited<ReturnType<typeof emulator.repairsOwnedBy>> = [];
    let docsB: Awaited<ReturnType<typeof emulator.repairsOwnedBy>> = [];

    const notFoundHeading = (page: Page) => page.getByRole("heading", { name: "Page not found" });

    await test.step("1. Seed one request for each customer and read the baseline", async () => {
      idA = await seed({ ownerId: customer.userId, overrides: dataA });
      idB = await seed({ ownerId: otherCustomer.userId, overrides: dataB });
      expect(idA).toMatch(/^[0-9a-f]{40}$/);
      expect(idB).toMatch(/^[0-9a-f]{40}$/);
      expect(idA).not.toBe(idB);

      docsA = await emulator.repairsOwnedBy(customer.userId);
      docsB = await emulator.repairsOwnedBy(otherCustomer.userId);
      expect(docsA.map((d) => d.id)).toEqual([idA]);
      expect(docsB.map((d) => d.id)).toEqual([idB]);
    });

    await test.step("2. Customer B's list shows B's request and nothing of A's", async () => {
      await pageB.goto("/customer");
      // Positive signal first: the list has rendered B's own row.
      await expect(repairRow(pageB, LIST_NAME.customer, tokenB)).toBeVisible();

      const list = pageB.getByRole("list", { name: LIST_NAME.customer });
      await expect(repairRow(pageB, LIST_NAME.customer, tokenA)).toHaveCount(0);
      await expect(list.locator(`a[href="/customer/repairs/${idA}"]`)).toHaveCount(0);
      await expect(list.getByText(tokenA)).toHaveCount(0);
      await expect(list.getByText("Brand A")).toHaveCount(0);
    });

    await test.step("3. Customer B opening A's request URL gets the not-found page", async () => {
      await pageB.goto(`/customer/repairs/${idA}`);
      await expect(notFoundHeading(pageB)).toBeVisible();
      await expect(pageB.getByText("Error 404")).toBeVisible();
      const body = pageB.locator("body");
      await expect(body).not.toContainText(tokenA);
      await expect(body).not.toContainText("Brand A");
      await expect(body).not.toContainText(dataA.description);
    });

    await test.step("4. A well-formed id that does not exist shows the same not-found heading", async () => {
      await pageB.goto(`/customer/repairs/${MISSING_ID}`);
      await expect(notFoundHeading(pageB)).toBeVisible();
      await expect(pageB.getByText("Error 404")).toBeVisible();
      await expect(pageB.locator("body")).not.toContainText(tokenA);
    });

    await test.step("5. Control: Customer B can open B's own request", async () => {
      await pageB.goto(`/customer/repairs/${idB}`);
      await expect(fact(pageB, "Model")).toHaveText(`Model ${tokenB}`);
      await expect(fact(pageB, "Brand")).toHaveText("Brand B");
      await expect(notFoundHeading(pageB)).toHaveCount(0);
    });

    await test.step("6. Customer A can still open A's request, and A's list shows only A's row", async () => {
      await pageA.goto(`/customer/repairs/${idA}`);
      await expect(fact(pageA, "Model")).toHaveText(`Model ${tokenA}`);
      await expect(fact(pageA, "Brand")).toHaveText("Brand A");
      await expect(fact(pageA, "Device type")).toHaveText("Phone");
      await expect(pageA.getByRole("main").getByText(dataA.description, { exact: true })).toBeVisible();
      await expect(notFoundHeading(pageA)).toHaveCount(0);

      await pageA.goto("/customer");
      await expect(repairRow(pageA, LIST_NAME.customer, tokenA)).toBeVisible();
      await expect(repairRow(pageA, LIST_NAME.customer, tokenB)).toHaveCount(0);
    });

    await test.step("7. Neither customer's stored documents changed", async () => {
      expect(await emulator.repairsOwnedBy(customer.userId)).toEqual(docsA);
      expect(await emulator.repairsOwnedBy(otherCustomer.userId)).toEqual(docsB);
    });
  });
});
